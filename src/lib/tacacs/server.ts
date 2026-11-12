import crypto from "crypto";
import net from "net";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { decryptSecret } from "@/lib/backupCrypto";
import {
  acctFlagsLabel,
  authenTypeLabel,
  buildAcctReplyBody,
  buildAcctRequestBody,
  buildAuthenContinueBody,
  buildAuthenReplyBody,
  buildAuthenStartBody,
  buildAuthorRequestBody,
  buildAuthorResponseBody,
  encodeTacacsPacket,
  obfuscateTacacsBody,
  parseAcctReply,
  parseAcctRequest,
  parseAuthenContinue,
  parseAuthenReply,
  parseAuthenStart,
  parseAuthorRequest,
  parseAuthorResponse,
  parseTacacsHeader,
  TAC_PLUS_ACCT_FLAG,
  TAC_PLUS_ACCT_STATUS,
  TAC_PLUS_AUTHEN_ACTION,
  TAC_PLUS_AUTHEN_STATUS,
  TAC_PLUS_AUTHEN_SVC,
  TAC_PLUS_AUTHEN_TYPE,
  TAC_PLUS_AUTHOR_STATUS,
  TAC_PLUS_CONTINUE_FLAG_ABORT,
  TAC_PLUS_FLAGS,
  TAC_PLUS_HEADER_SIZE,
  TAC_PLUS_MAX_PACKET_BODY,
  TAC_PLUS_REPLY_FLAG_NOECHO,
  TAC_PLUS_TYPE,
  TAC_PLUS_VER_DEFAULT,
  TacacsHeader,
} from "@/lib/tacacs/protocol";
import {
  evaluateCommandAuthorization,
  extractArgsMetadata,
  matchIpOrCidr,
  normalizeIpAddress,
  parseCommandRules,
  parseServiceAttrs,
} from "@/lib/tacacs/policy";
import {
  getPlainDefaultEnablePassword,
  getPlainDefaultSecret,
  getTacacsSettings,
  seedDefaultTacacsGroupsIfEmpty,
  TacacsServerSettings,
} from "@/lib/tacacs/settings";

export type TacacsRuntimeState = "STOPPED" | "RUNNING" | "ERROR";

export interface TacacsServerRuntimeStatus {
  state: TacacsRuntimeState;
  bind_host: string;
  port: number;
  started_at: string | null;
  uptime_sec: number;
  active_connections: number;
  total_packets: number;
  authen_pass: number;
  authen_fail: number;
  author_pass: number;
  author_fail: number;
  acct_count: number;
  last_error: string | null;
}

interface ResolvedClient {
  id: string | null;
  name: string;
  secretKey: string | null;
  vendor: string;
}

interface ResolvedUserPolicy {
  found: boolean;
  source: "tacacs_user" | "actis_fallback" | "none";
  id?: string;
  username: string;
  isActive: boolean;
  isExpired: boolean;
  privilegeLevel: number;
  passwordHash?: string;
  chapSecret?: string | null;
  enablePasswordHash?: string | null;
  groupName?: string | null;
  defaultPolicy: "permit" | "deny";
  commandRules: ReturnType<typeof parseCommandRules>;
  serviceAttrs: ReturnType<typeof parseServiceAttrs>;
  actisEmail?: string;
}

interface PendingAuthenSession {
  stage: "WAIT_USER" | "WAIT_PASS";
  action: number;
  privLvl: number;
  authenType: number;
  authenService: number;
  username: string;
  port: string;
  remAddr: string;
  version: number;
  flags: number;
}

interface GlobalTacacsHolder {
  server: net.Server | null;
  sockets: Set<net.Socket>;
  state: TacacsRuntimeState;
  bindHost: string;
  port: number;
  startedAt: Date | null;
  totalPackets: number;
  authenPass: number;
  authenFail: number;
  authorPass: number;
  authorFail: number;
  acctCount: number;
  lastError: string | null;
  bootstrapped: boolean;
  lastPruneAt: number;
}

const g = globalThis as unknown as { __actisTacacsRuntime?: GlobalTacacsHolder };

function getHolder(): GlobalTacacsHolder {
  if (!g.__actisTacacsRuntime) {
    g.__actisTacacsRuntime = {
      server: null,
      sockets: new Set(),
      state: "STOPPED",
      bindHost: "0.0.0.0",
      port: 49,
      startedAt: null,
      totalPackets: 0,
      authenPass: 0,
      authenFail: 0,
      authorPass: 0,
      authorFail: 0,
      acctCount: 0,
      lastError: null,
      bootstrapped: false,
      lastPruneAt: 0,
    };
  }
  return g.__actisTacacsRuntime;
}

function prefixLen(ipOrCidr: string): number {
  const idx = ipOrCidr.indexOf("/");
  if (idx === -1) return 128; // exact IP has highest priority
  const n = parseInt(ipOrCidr.slice(idx + 1), 10);
  return Number.isNaN(n) ? 0 : n;
}

async function resolveNasClient(
  rawIp: string,
  settings: TacacsServerSettings
): Promise<ResolvedClient | null> {
  const clientIp = normalizeIpAddress(rawIp);
  const clients = await prisma.tacacsClient.findMany({
    where: { is_active: true },
  });

  // Sort longest-prefix first so specific /32 host entries win over /24 or 0.0.0.0/0
  const matched = clients
    .filter((c) => matchIpOrCidr(clientIp, c.ip_or_cidr))
    .sort((a, b) => prefixLen(b.ip_or_cidr) - prefixLen(a.ip_or_cidr))[0];

  if (matched) {
    prisma.tacacsClient
      .update({
        where: { id: matched.id },
        data: { last_seen_at: new Date() },
      })
      .catch(() => {});

    return {
      id: matched.id,
      name: matched.name,
      secretKey: decryptSecret(matched.shared_secret_enc),
      vendor: matched.vendor,
    };
  }

  if (settings.require_registered_client) {
    return null;
  }

  return {
    id: null,
    name: `Unregistered (${clientIp})`,
    secretKey: getPlainDefaultSecret(settings),
    vendor: "custom",
  };
}

async function resolveUserPolicy(
  username: string,
  settings: TacacsServerSettings
): Promise<ResolvedUserPolicy> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    return {
      found: false,
      source: "none",
      username: "",
      isActive: false,
      isExpired: false,
      privilegeLevel: 1,
      defaultPolicy: "deny",
      commandRules: [],
      serviceAttrs: [],
    };
  }

  const user = await prisma.tacacsUser.findUnique({
    where: { username: cleanUsername },
    include: { group: true },
  });

  if (user) {
    const isExpired = Boolean(user.expires_at && user.expires_at.getTime() < Date.now());
    const groupActive = user.group ? user.group.is_active : true;
    const priv =
      user.privilege_level !== null && user.privilege_level !== undefined
        ? user.privilege_level
        : user.group?.privilege_level ?? 1;

    const rules = user.group ? parseCommandRules(user.group.command_rules) : [];
    const defaultPolicy =
      user.group?.default_policy === "permit"
        ? "permit"
        : user.group
          ? "deny"
          : priv >= 15
            ? "permit"
            : "deny";

    return {
      found: true,
      source: "tacacs_user",
      id: user.id,
      username: user.username,
      isActive: user.is_active && groupActive,
      isExpired,
      privilegeLevel: priv,
      passwordHash: user.password_hash,
      chapSecret: decryptSecret(user.chap_secret_enc),
      enablePasswordHash: user.enable_password_hash,
      groupName: user.group?.name ?? null,
      defaultPolicy,
      commandRules: rules,
      serviceAttrs: user.group ? parseServiceAttrs(user.group.service_attrs) : [],
    };
  }

  if (settings.allow_actis_users_fallback) {
    const actisUser = await prisma.user.findFirst({
      where: {
        role: { in: ["admin", "noc_engineer"] },
        OR: [{ email: cleanUsername }, { nama: cleanUsername }],
      },
    });
    if (actisUser) {
      const isAdmin = actisUser.role === "admin";
      return {
        found: true,
        source: "actis_fallback",
        id: actisUser.id,
        username: cleanUsername,
        isActive: true,
        isExpired: false,
        privilegeLevel: isAdmin ? 15 : 7,
        passwordHash: actisUser.password_hash ?? undefined,
        actisEmail: actisUser.email,
        groupName: isAdmin ? "actis-admin" : "actis-noc",
        defaultPolicy: isAdmin ? "permit" : "deny",
        commandRules: isAdmin
          ? [{ id: "actis-admin", action: "permit", pattern: ".*" }]
          : [
              {
                id: "actis-noc-deny",
                action: "deny",
                pattern: "^(reload|reboot|write erase|erase|format|reset)",
              },
              {
                id: "actis-noc-allow",
                action: "permit",
                pattern: "^(show|display|ping|traceroute|configure|interface)",
              },
            ],
        serviceAttrs: [],
      };
    }
  }

  return {
    found: false,
    source: "none",
    username: cleanUsername,
    isActive: false,
    isExpired: false,
    privilegeLevel: 1,
    defaultPolicy: "deny",
    commandRules: [],
    serviceAttrs: [],
  };
}

function verifyChapChallenge(plainSecret: string, data: Buffer): boolean {
  // RFC 8907 CHAP data: 1 byte PPP id + challenge + 16 bytes MD5 response
  if (data.length < 18) return false;
  const chapId = data.subarray(0, 1);
  const response = data.subarray(data.length - 16);
  const challenge = data.subarray(1, data.length - 16);

  const expected = crypto
    .createHash("md5")
    .update(chapId)
    .update(Buffer.from(plainSecret, "utf8"))
    .update(challenge)
    .digest();

  if (expected.length !== response.length) return false;
  return crypto.timingSafeEqual(expected, response);
}

async function verifyUserCredentials(params: {
  policy: ResolvedUserPolicy;
  password?: string;
  authenType: number;
  authenService: number;
  chapData?: Buffer;
  settings: TacacsServerSettings;
}): Promise<{ ok: boolean; reason: string }> {
  const { policy, password, authenType, authenService, chapData, settings } = params;

  if (!policy.found) {
    return { ok: false, reason: "Username tidak terdaftar di TACACS+ Server" };
  }
  if (!policy.isActive) {
    return { ok: false, reason: "Akun atau grup user dalam status nonaktif" };
  }
  if (policy.isExpired) {
    return { ok: false, reason: "Masa berlaku akun TACACS+ telah kedaluwarsa" };
  }

  if (authenService === TAC_PLUS_AUTHEN_SVC.ENABLE) {
    const pass = password ?? "";
    if (policy.enablePasswordHash) {
      const ok = verifyPassword(pass, policy.enablePasswordHash);
      return ok ? { ok: true, reason: "Enable password valid" } : { ok: false, reason: "Enable password salah" };
    }
    const defaultEnable = getPlainDefaultEnablePassword(settings);
    if (defaultEnable) {
      const a = Buffer.from(pass, "utf8");
      const b = Buffer.from(defaultEnable, "utf8");
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      return ok
        ? { ok: true, reason: "Global enable password valid" }
        : { ok: false, reason: "Enable password salah" };
    }
    // Fallback to user's own password if enable password is not explicitly configured
    if (policy.passwordHash) {
      const ok = verifyPassword(pass, policy.passwordHash, policy.actisEmail);
      return ok ? { ok: true, reason: "Enable password (user fallback) valid" } : { ok: false, reason: "Enable password salah" };
    }
    return { ok: false, reason: "Enable password tidak dikonfigurasi" };
  }

  if (authenType === TAC_PLUS_AUTHEN_TYPE.CHAP) {
    if (!policy.chapSecret || !chapData) {
      return { ok: false, reason: "Akun tidak memiliki secret CHAP atau payload CHAP tidak valid" };
    }
    const ok = verifyChapChallenge(policy.chapSecret, chapData);
    return ok ? { ok: true, reason: "CHAP challenge valid" } : { ok: false, reason: "CHAP response salah" };
  }

  // ASCII or PAP
  if (policy.passwordHash !== undefined || policy.source === "actis_fallback") {
    const ok = verifyPassword(password ?? "", policy.passwordHash ?? null, policy.actisEmail);
    return ok ? { ok: true, reason: "Autentikasi berhasil" } : { ok: false, reason: "Password salah" };
  }

  return { ok: false, reason: "Metode autentikasi tidak didukung" };
}

async function writeAuditLog(entry: {
  event_type: "AUTHEN" | "AUTHOR" | "ACCT";
  status: string;
  username: string;
  client_ip: string;
  client_name?: string | null;
  remote_addr?: string | null;
  port?: string | null;
  authen_type?: string | null;
  service?: string | null;
  priv_lvl?: number | null;
  command?: string | null;
  args_json?: string | null;
  session_id?: string | null;
  elapsed_sec?: number | null;
  detail?: string | null;
}) {
  try {
    await prisma.tacacsAuditLog.create({
      data: {
        event_type: entry.event_type,
        status: entry.status,
        username: entry.username || "(unknown)",
        client_ip: entry.client_ip,
        client_name: entry.client_name ?? null,
        remote_addr: entry.remote_addr ?? null,
        port: entry.port ?? null,
        authen_type: entry.authen_type ?? null,
        service: entry.service ?? null,
        priv_lvl: entry.priv_lvl ?? null,
        command: entry.command ?? null,
        args_json: entry.args_json ?? null,
        session_id: entry.session_id ?? null,
        elapsed_sec: entry.elapsed_sec ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch (err) {
    console.error("[TACACS+] Failed to write audit log:", err);
  }
}

async function maybePruneAuditLogs(retentionDays: number) {
  const holder = getHolder();
  const now = Date.now();
  if (now - holder.lastPruneAt < 12 * 60 * 60 * 1000) return;
  holder.lastPruneAt = now;
  try {
    const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
    await prisma.tacacsAuditLog.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
  } catch (err) {
    console.error("[TACACS+] Failed to prune audit logs:", err);
  }
}

async function processTacacsPacket(params: {
  header: TacacsHeader;
  rawBody: Buffer;
  socket: net.Socket;
  client: ResolvedClient;
  settings: TacacsServerSettings;
  sessions: Map<number, PendingAuthenSession>;
}) {
  const { header, rawBody, socket, client, settings, sessions } = params;
  const holder = getHolder();
  const clientIp = normalizeIpAddress(socket.remoteAddress);
  const sessionHex = `0x${(header.sessionId >>> 0).toString(16).padStart(8, "0")}`;
  const isClientUnencrypted = (header.flags & TAC_PLUS_FLAGS.UNENCRYPTED) !== 0;

  if (isClientUnencrypted && !settings.allow_unencrypted) {
    await writeAuditLog({
      event_type: "AUTHEN",
      status: "ERROR",
      username: "(unknown)",
      client_ip: clientIp,
      client_name: client.name,
      session_id: sessionHex,
      detail: "Paket unencrypted ditolak oleh kebijakan server (allow_unencrypted=false)",
    });
    const errBody = buildAuthenReplyBody({
      status: TAC_PLUS_AUTHEN_STATUS.ERROR,
      serverMsg: "Unencrypted TACACS+ packets are prohibited by policy",
    });
    socket.write(
      encodeTacacsPacket({
        version: header.version,
        type: header.type,
        seqNo: header.seqNo + 1,
        flags: header.flags,
        sessionId: header.sessionId,
        body: errBody,
        secretKey: client.secretKey ?? undefined,
      })
    );
    return;
  }

  const plainBody =
    isClientUnencrypted || !client.secretKey
      ? rawBody
      : obfuscateTacacsBody(
          rawBody,
          client.secretKey,
          header.sessionId,
          header.version,
          header.seqNo
        );

  const sendReply = (body: Buffer) => {
    const respFlags =
      (header.flags & TAC_PLUS_FLAGS.SINGLE_CONNECT) |
      (isClientUnencrypted ? TAC_PLUS_FLAGS.UNENCRYPTED : 0);

    const pkt = encodeTacacsPacket({
      version: header.version,
      type: header.type,
      seqNo: (header.seqNo + 1) & 0xff,
      flags: respFlags,
      sessionId: header.sessionId,
      body,
      secretKey: isClientUnencrypted ? undefined : client.secretKey ?? undefined,
    });
    socket.write(pkt);
  };

  holder.totalPackets++;

  // ==========================================================================
  // 1. AUTHENTICATION (TAC_PLUS_AUTHEN = 0x01)
  // ==========================================================================
  if (header.type === TAC_PLUS_TYPE.AUTHEN) {
    if (header.seqNo === 1) {
      const start = parseAuthenStart(plainBody);
      const authLabel = authenTypeLabel(start.authenType, start.authenService);

      if (start.action !== TAC_PLUS_AUTHEN_ACTION.LOGIN) {
        holder.authenFail++;
        sendReply(
          buildAuthenReplyBody({
            status: TAC_PLUS_AUTHEN_STATUS.FAIL,
            serverMsg: "Only LOGIN authentication action is supported",
          })
        );
        return;
      }

      // ASCII Interactive Flow
      if (start.authenType === TAC_PLUS_AUTHEN_TYPE.ASCII) {
        if (!start.user && start.authenService !== TAC_PLUS_AUTHEN_SVC.ENABLE) {
          sessions.set(header.sessionId, {
            stage: "WAIT_USER",
            action: start.action,
            privLvl: start.privLvl,
            authenType: start.authenType,
            authenService: start.authenService,
            username: "",
            port: start.port,
            remAddr: start.remAddr,
            version: header.version,
            flags: header.flags,
          });
          sendReply(
            buildAuthenReplyBody({
              status: TAC_PLUS_AUTHEN_STATUS.GETUSER,
              serverMsg: "Username: ",
            })
          );
          return;
        }

        // Username present (or ENABLE service) -> prompt Password
        sessions.set(header.sessionId, {
          stage: "WAIT_PASS",
          action: start.action,
          privLvl: start.privLvl,
          authenType: start.authenType,
          authenService: start.authenService,
          username: start.user,
          port: start.port,
          remAddr: start.remAddr,
          version: header.version,
          flags: header.flags,
        });
        sendReply(
          buildAuthenReplyBody({
            status: TAC_PLUS_AUTHEN_STATUS.GETPASS,
            flags: TAC_PLUS_REPLY_FLAG_NOECHO,
            serverMsg:
              start.authenService === TAC_PLUS_AUTHEN_SVC.ENABLE
                ? "Enable Password: "
                : "Password: ",
          })
        );
        return;
      }

      // Single-step PAP or CHAP
      const policy = await resolveUserPolicy(start.user, settings);
      const result = await verifyUserCredentials({
        policy,
        password:
          start.authenType === TAC_PLUS_AUTHEN_TYPE.PAP
            ? start.data.toString("utf8")
            : undefined,
        authenType: start.authenType,
        authenService: start.authenService,
        chapData: start.authenType === TAC_PLUS_AUTHEN_TYPE.CHAP ? start.data : undefined,
        settings,
      });

      if (result.ok) {
        holder.authenPass++;
        if (policy.source === "tacacs_user" && policy.id) {
          prisma.tacacsUser
            .update({
              where: { id: policy.id },
              data: { last_login_at: new Date(), last_login_ip: start.remAddr || clientIp },
            })
            .catch(() => {});
        }
        await writeAuditLog({
          event_type: "AUTHEN",
          status: "PASS",
          username: start.user,
          client_ip: clientIp,
          client_name: client.name,
          remote_addr: start.remAddr,
          port: start.port,
          authen_type: authLabel,
          priv_lvl: policy.privilegeLevel,
          session_id: sessionHex,
          detail: result.reason,
        });
        sendReply(
          buildAuthenReplyBody({
            status: TAC_PLUS_AUTHEN_STATUS.PASS,
            serverMsg: "Authentication succeeded",
          })
        );
      } else {
        holder.authenFail++;
        await writeAuditLog({
          event_type: "AUTHEN",
          status: "FAIL",
          username: start.user,
          client_ip: clientIp,
          client_name: client.name,
          remote_addr: start.remAddr,
          port: start.port,
          authen_type: authLabel,
          session_id: sessionHex,
          detail: result.reason,
        });
        sendReply(
          buildAuthenReplyBody({
            status: TAC_PLUS_AUTHEN_STATUS.FAIL,
            serverMsg: "Authentication failed",
          })
        );
      }
      return;
    }

    // AUTHEN CONTINUE (seqNo = 3 or 5)
    const cont = parseAuthenContinue(plainBody);
    const pending = sessions.get(header.sessionId);
    if (!pending) {
      holder.authenFail++;
      sendReply(
        buildAuthenReplyBody({
          status: TAC_PLUS_AUTHEN_STATUS.ERROR,
          serverMsg: "Unknown or expired TACACS+ authentication session",
        })
      );
      return;
    }

    if ((cont.flags & TAC_PLUS_CONTINUE_FLAG_ABORT) !== 0) {
      sessions.delete(header.sessionId);
      holder.authenFail++;
      await writeAuditLog({
        event_type: "AUTHEN",
        status: "FAIL",
        username: pending.username || "(aborted)",
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: pending.remAddr,
        port: pending.port,
        authen_type: authenTypeLabel(pending.authenType, pending.authenService),
        session_id: sessionHex,
        detail: "Sesi autentikasi dibatalkan oleh klien (ABORT flag)",
      });
      sendReply(
        buildAuthenReplyBody({
          status: TAC_PLUS_AUTHEN_STATUS.FAIL,
          serverMsg: "Authentication aborted",
        })
      );
      return;
    }

    if (pending.stage === "WAIT_USER") {
      pending.username = cont.userMsg.trim();
      pending.stage = "WAIT_PASS";
      sendReply(
        buildAuthenReplyBody({
          status: TAC_PLUS_AUTHEN_STATUS.GETPASS,
          flags: TAC_PLUS_REPLY_FLAG_NOECHO,
          serverMsg: "Password: ",
        })
      );
      return;
    }

    // stage === "WAIT_PASS"
    sessions.delete(header.sessionId);
    const authLabel = authenTypeLabel(pending.authenType, pending.authenService);
    const policy = await resolveUserPolicy(pending.username, settings);
    const result = await verifyUserCredentials({
      policy,
      password: cont.userMsg,
      authenType: pending.authenType,
      authenService: pending.authenService,
      settings,
    });

    if (result.ok) {
      holder.authenPass++;
      if (policy.source === "tacacs_user" && policy.id) {
        prisma.tacacsUser
          .update({
            where: { id: policy.id },
            data: { last_login_at: new Date(), last_login_ip: pending.remAddr || clientIp },
          })
          .catch(() => {});
      }
      await writeAuditLog({
        event_type: "AUTHEN",
        status: "PASS",
        username: pending.username,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: pending.remAddr,
        port: pending.port,
        authen_type: authLabel,
        priv_lvl: policy.privilegeLevel,
        session_id: sessionHex,
        detail: result.reason,
      });
      sendReply(
        buildAuthenReplyBody({
          status: TAC_PLUS_AUTHEN_STATUS.PASS,
          serverMsg: "Authentication succeeded",
        })
      );
    } else {
      holder.authenFail++;
      await writeAuditLog({
        event_type: "AUTHEN",
        status: "FAIL",
        username: pending.username,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: pending.remAddr,
        port: pending.port,
        authen_type: authLabel,
        session_id: sessionHex,
        detail: result.reason,
      });
      sendReply(
        buildAuthenReplyBody({
          status: TAC_PLUS_AUTHEN_STATUS.FAIL,
          serverMsg: "Authentication failed",
        })
      );
    }
    return;
  }

  // ==========================================================================
  // 2. AUTHORIZATION (TAC_PLUS_AUTHOR = 0x02)
  // ==========================================================================
  if (header.type === TAC_PLUS_TYPE.AUTHOR) {
    const req = parseAuthorRequest(plainBody);
    const meta = extractArgsMetadata(req.args);
    const policy = await resolveUserPolicy(req.user, settings);

    if (!policy.found || !policy.isActive || policy.isExpired) {
      holder.authorFail++;
      const reason = !policy.found
        ? "User tidak terdaftar"
        : policy.isExpired
          ? "Akun telah kedaluwarsa"
          : "Akun atau grup nonaktif";
      await writeAuditLog({
        event_type: "AUTHOR",
        status: "FAIL",
        username: req.user,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: req.remAddr,
        port: req.port,
        service: meta.service,
        command: meta.fullCommand,
        args_json: JSON.stringify(req.args),
        session_id: sessionHex,
        detail: reason,
      });
      sendReply(
        buildAuthorResponseBody({
          status: TAC_PLUS_AUTHOR_STATUS.FAIL,
          serverMsg: reason,
        })
      );
      return;
    }

    // Shell / Exec session authorization (no cmd specified)
    if (meta.isShellLogin) {
      holder.authorPass++;
      const outArgs = [`priv-lvl=${policy.privilegeLevel}`];
      for (const attr of policy.serviceAttrs) {
        outArgs.push(`${attr.key}=${attr.value}`);
      }
      await writeAuditLog({
        event_type: "AUTHOR",
        status: "PASS",
        username: req.user,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: req.remAddr,
        port: req.port,
        service: meta.service,
        priv_lvl: policy.privilegeLevel,
        args_json: JSON.stringify(req.args),
        session_id: sessionHex,
        detail: `Shell authorization granted (priv-lvl=${policy.privilegeLevel}${policy.groupName ? `, group=${policy.groupName}` : ""})`,
      });
      sendReply(
        buildAuthorResponseBody({
          status: TAC_PLUS_AUTHOR_STATUS.PASS_ADD,
          args: outArgs,
        })
      );
      return;
    }

    // Per-command authorization
    const evalRes = evaluateCommandAuthorization({
      fullCommand: meta.fullCommand || "",
      rules: policy.commandRules,
      defaultPolicy: policy.defaultPolicy,
    });

    if (evalRes.allowed) {
      holder.authorPass++;
      await writeAuditLog({
        event_type: "AUTHOR",
        status: "PASS",
        username: req.user,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: req.remAddr,
        port: req.port,
        service: meta.service,
        priv_lvl: policy.privilegeLevel,
        command: meta.fullCommand,
        args_json: JSON.stringify(req.args),
        session_id: sessionHex,
        detail: evalRes.reason,
      });
      sendReply(
        buildAuthorResponseBody({
          status: TAC_PLUS_AUTHOR_STATUS.PASS_ADD,
          args: [`priv-lvl=${policy.privilegeLevel}`],
        })
      );
    } else {
      holder.authorFail++;
      await writeAuditLog({
        event_type: "AUTHOR",
        status: "FAIL",
        username: req.user,
        client_ip: clientIp,
        client_name: client.name,
        remote_addr: req.remAddr,
        port: req.port,
        service: meta.service,
        priv_lvl: policy.privilegeLevel,
        command: meta.fullCommand,
        args_json: JSON.stringify(req.args),
        session_id: sessionHex,
        detail: evalRes.reason,
      });
      sendReply(
        buildAuthorResponseBody({
          status: TAC_PLUS_AUTHOR_STATUS.FAIL,
          serverMsg: `Command denied: ${meta.fullCommand}`,
        })
      );
    }
    return;
  }

  // ==========================================================================
  // 3. ACCOUNTING (TAC_PLUS_ACCT = 0x03)
  // ==========================================================================
  if (header.type === TAC_PLUS_TYPE.ACCT) {
    const req = parseAcctRequest(plainBody);
    const meta = extractArgsMetadata(req.args);
    const flagLabel = acctFlagsLabel(req.flags);
    holder.acctCount++;

    await writeAuditLog({
      event_type: "ACCT",
      status: flagLabel,
      username: req.user,
      client_ip: clientIp,
      client_name: client.name,
      remote_addr: req.remAddr,
      port: req.port,
      authen_type: authenTypeLabel(req.authenType, req.authenService),
      service: meta.service,
      priv_lvl: req.privLvl,
      command: meta.fullCommand,
      args_json: JSON.stringify(req.args),
      session_id: sessionHex,
      elapsed_sec: meta.elapsedSec,
      detail: meta.fullCommand
        ? `Command accounting (${flagLabel}): ${meta.fullCommand}`
        : `Session accounting (${flagLabel}) on service=${meta.service}`,
    });

    sendReply(
      buildAcctReplyBody({
        status: TAC_PLUS_ACCT_STATUS.SUCCESS,
        serverMsg: "Accounting recorded",
      })
    );
  }
}

export function getTacacsRuntimeStatus(): TacacsServerRuntimeStatus {
  const holder = getHolder();
  const uptimeSec =
    holder.state === "RUNNING" && holder.startedAt
      ? Math.floor((Date.now() - holder.startedAt.getTime()) / 1000)
      : 0;
  return {
    state: holder.state,
    bind_host: holder.bindHost,
    port: holder.port,
    started_at: holder.startedAt ? holder.startedAt.toISOString() : null,
    uptime_sec: uptimeSec,
    active_connections: holder.sockets.size,
    total_packets: holder.totalPackets,
    authen_pass: holder.authenPass,
    authen_fail: holder.authenFail,
    author_pass: holder.authorPass,
    author_fail: holder.authorFail,
    acct_count: holder.acctCount,
    last_error: holder.lastError,
  };
}

export async function stopTacacsServer(): Promise<TacacsServerRuntimeStatus> {
  const holder = getHolder();
  for (const sock of holder.sockets) {
    try {
      sock.destroy();
    } catch {
      // ignore
    }
  }
  holder.sockets.clear();

  if (holder.server) {
    await new Promise<void>((resolve) => {
      try {
        holder.server?.close(() => resolve());
      } catch {
        resolve();
      }
    });
    holder.server = null;
  }

  holder.state = "STOPPED";
  holder.startedAt = null;
  return getTacacsRuntimeStatus();
}

export async function startTacacsServer(overrideSettings?: TacacsServerSettings): Promise<TacacsServerRuntimeStatus> {
  const holder = getHolder();
  await stopTacacsServer();

  const settings = overrideSettings ?? (await getTacacsSettings());
  holder.bindHost = settings.bind_host;
  holder.port = settings.port;
  holder.lastError = null;

  if (!settings.enabled) {
    holder.state = "STOPPED";
    return getTacacsRuntimeStatus();
  }

  await seedDefaultTacacsGroupsIfEmpty().catch(() => {});
  maybePruneAuditLogs(settings.log_retention_days).catch(() => {});

  const server = net.createServer((socket) => {
    holder.sockets.add(socket);
    socket.setTimeout(settings.socket_timeout_ms);

    let rxBuffer = Buffer.alloc(0);
    const sessions = new Map<number, PendingAuthenSession>();
    let processing = Promise.resolve();

    socket.on("timeout", () => {
      socket.destroy();
    });

    socket.on("error", () => {
      holder.sockets.delete(socket);
    });

    socket.on("close", () => {
      holder.sockets.delete(socket);
      sessions.clear();
    });

    socket.on("data", (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      const frames: { header: TacacsHeader; body: Buffer }[] = [];
      while (rxBuffer.length >= TAC_PLUS_HEADER_SIZE) {
        const header = parseTacacsHeader(rxBuffer);
        if (header.majorVersion !== 0x0c) {
          socket.destroy();
          return;
        }
        if (header.length > TAC_PLUS_MAX_PACKET_BODY) {
          socket.destroy();
          return;
        }
        const totalLen = TAC_PLUS_HEADER_SIZE + header.length;
        if (rxBuffer.length < totalLen) {
          break;
        }
        const body = Buffer.from(rxBuffer.subarray(TAC_PLUS_HEADER_SIZE, totalLen));
        rxBuffer = rxBuffer.subarray(totalLen);
        frames.push({ header, body });
      }

      if (frames.length === 0) return;

      processing = processing.then(async () => {
        const liveSettings = await getTacacsSettings();
        const rawIp = normalizeIpAddress(socket.remoteAddress);
        const client = await resolveNasClient(rawIp, liveSettings);

        if (!client) {
          await writeAuditLog({
            event_type: "AUTHEN",
            status: "ERROR",
            username: "(unknown)",
            client_ip: rawIp,
            detail: `Koneksi ditolak: NAS IP ${rawIp} belum terdaftar pada TACACS+ Clients`,
          });
          socket.destroy();
          return;
        }

        for (const frame of frames) {
          try {
            await processTacacsPacket({
              header: frame.header,
              rawBody: frame.body,
              socket,
              client,
              settings: liveSettings,
              sessions,
            });
          } catch (err: any) {
            console.error("[TACACS+] Packet processing error:", err);
            await writeAuditLog({
              event_type: "AUTHEN",
              status: "ERROR",
              username: "(unknown)",
              client_ip: rawIp,
              client_name: client.name,
              detail: `Gagal memproses paket TACACS+: ${err?.message || "Malformed packet or wrong shared secret"}`,
            });
            socket.destroy();
            return;
          }
        }
      });
    });
  });

  await new Promise<void>((resolve) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      holder.state = "ERROR";
      if (err.code === "EACCES") {
        holder.lastError = `Izin ditolak saat bind port ${settings.port} (EACCES). Pada Linux/Docker non-root, gunakan port >= 1024 (mis. 4949) atau aktifkan CAP_NET_BIND_SERVICE.`;
      } else if (err.code === "EADDRINUSE") {
        holder.lastError = `Port ${settings.port} sudah digunakan proses lain (EADDRINUSE).`;
      } else {
        holder.lastError = err.message || "Gagal menjalankan TCP listener TACACS+.";
      }
      holder.server = null;
      resolve();
    });

    server.listen(settings.port, settings.bind_host, () => {
      holder.server = server;
      holder.state = "RUNNING";
      holder.startedAt = new Date();
      holder.lastError = null;
      console.log(
        `==> [TACACS+] RFC 8907 Server listening on ${settings.bind_host}:${settings.port}`
      );
      resolve();
    });
  });

  return getTacacsRuntimeStatus();
}

export async function ensureTacacsServerStarted(): Promise<TacacsServerRuntimeStatus> {
  const holder = getHolder();
  if (holder.bootstrapped) {
    return getTacacsRuntimeStatus();
  }
  holder.bootstrapped = true;
  return startTacacsServer();
}

// ============================================================================
// INTERACTIVE AAA & WIRE-PROTOCOL SIMULATOR FOR ADMIN TESTING
// ============================================================================

async function sendTcpTacacsRoundtrip(params: {
  host: string;
  port: number;
  secretKey: string;
  packets: Buffer[];
}): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: params.host, port: params.port });
    const responses: Buffer[] = [];
    let rxBuffer = Buffer.alloc(0);
    let idx = 0;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timeout menghubungi TACACS+ TCP listener"));
    }, 5000);

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on("connect", () => {
      socket.write(params.packets[0]);
    });

    socket.on("data", (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);
      while (rxBuffer.length >= TAC_PLUS_HEADER_SIZE) {
        const hdr = parseTacacsHeader(rxBuffer);
        const total = TAC_PLUS_HEADER_SIZE + hdr.length;
        if (rxBuffer.length < total) break;
        const pkt = Buffer.from(rxBuffer.subarray(0, total));
        rxBuffer = rxBuffer.subarray(total);
        responses.push(pkt);
        idx++;
        if (idx < params.packets.length) {
          socket.write(params.packets[idx]);
        } else {
          clearTimeout(timer);
          socket.end();
          resolve(responses);
        }
      }
    });
  });
}

export async function runTacacsSimulation(input: {
  username: string;
  password: string;
  clientIp: string;
  command?: string;
  authenMode?: "PAP" | "ASCII" | "CHAP";
}) {
  const settings = await getTacacsSettings();
  const client = await resolveNasClient(input.clientIp || "127.0.0.1", settings);
  const policy = await resolveUserPolicy(input.username, settings);

  const authenType =
    input.authenMode === "CHAP"
      ? TAC_PLUS_AUTHEN_TYPE.CHAP
      : input.authenMode === "ASCII"
        ? TAC_PLUS_AUTHEN_TYPE.ASCII
        : TAC_PLUS_AUTHEN_TYPE.PAP;

  // Test wire protocol over loopback if server is RUNNING and client matched 127.0.0.1
  const holder = getHolder();
  let wireTested = false;
  let wireError: string | null = null;

  if (holder.state === "RUNNING" && client?.secretKey) {
    try {
      const host = holder.bindHost === "0.0.0.0" ? "127.0.0.1" : holder.bindHost;
      const sessionId = crypto.randomBytes(4).readUInt32BE(0);
      const authenBody = buildAuthenStartBody({
        action: TAC_PLUS_AUTHEN_ACTION.LOGIN,
        privLvl: 1,
        authenType: TAC_PLUS_AUTHEN_TYPE.PAP,
        authenService: TAC_PLUS_AUTHEN_SVC.LOGIN,
        user: input.username,
        port: "sim-vty0",
        remAddr: normalizeIpAddress(input.clientIp) || "127.0.0.1",
        data: input.password,
      });
      const authenPkt = encodeTacacsPacket({
        version: TAC_PLUS_VER_DEFAULT,
        type: TAC_PLUS_TYPE.AUTHEN,
        seqNo: 1,
        flags: 0,
        sessionId,
        body: authenBody,
        secretKey: client.secretKey,
      });

      // Only run full loopback if 127.0.0.1 is permitted by NAS client table
      const loopbackAllowed = await resolveNasClient("127.0.0.1", settings);
      if (loopbackAllowed?.secretKey) {
        const loopbackPkt = encodeTacacsPacket({
          version: TAC_PLUS_VER_DEFAULT,
          type: TAC_PLUS_TYPE.AUTHEN,
          seqNo: 1,
          flags: 0,
          sessionId,
          body: authenBody,
          secretKey: loopbackAllowed.secretKey,
        });
        const resps = await sendTcpTacacsRoundtrip({
          host,
          port: holder.port,
          secretKey: loopbackAllowed.secretKey,
          packets: [loopbackPkt],
        });
        if (resps.length > 0) {
          const rHdr = parseTacacsHeader(resps[0]);
          const rBody = obfuscateTacacsBody(
            resps[0].subarray(TAC_PLUS_HEADER_SIZE),
            loopbackAllowed.secretKey,
            rHdr.sessionId,
            rHdr.version,
            rHdr.seqNo
          );
          parseAuthenReply(rBody);
          wireTested = true;
        }
      } else {
        void authenPkt;
      }
    } catch (err: any) {
      wireError = err?.message || "Loopback wire check skipped";
    }
  }

  let chapData: Buffer | undefined;
  if (authenType === TAC_PLUS_AUTHEN_TYPE.CHAP) {
    const id = Buffer.from([1]);
    const challenge = crypto.randomBytes(16);
    const md5 = crypto
      .createHash("md5")
      .update(id)
      .update(Buffer.from(input.password, "utf8"))
      .update(challenge)
      .digest();
    chapData = Buffer.concat([id, challenge, md5]);
  }

  const authenResult = client
    ? await verifyUserCredentials({
        policy,
        password: input.password,
        authenType,
        authenService: TAC_PLUS_AUTHEN_SVC.LOGIN,
        chapData,
        settings,
      })
    : {
        ok: false,
        reason: `NAS Client IP ${normalizeIpAddress(input.clientIp)} tidak terdaftar (require_registered_client=true)`,
      };

  const shellAuthor =
    authenResult.ok && policy.found && policy.isActive && !policy.isExpired
      ? {
          allowed: true,
          priv_lvl: policy.privilegeLevel,
          attrs: [
            `priv-lvl=${policy.privilegeLevel}`,
            ...policy.serviceAttrs.map((a) => `${a.key}=${a.value}`),
          ],
        }
      : {
          allowed: false,
          priv_lvl: 0,
          attrs: [],
        };

  const trimmedCmd = (input.command || "").trim();
  const cmdAuthor =
    trimmedCmd.length > 0
      ? authenResult.ok
        ? evaluateCommandAuthorization({
            fullCommand: trimmedCmd,
            rules: policy.commandRules,
            defaultPolicy: policy.defaultPolicy,
          })
        : { allowed: false, reason: "Tidak dievaluasi karena autentikasi gagal" }
      : null;

  return {
    wire_tested: wireTested,
    wire_error: wireError,
    nas_client: client
      ? { matched: true, name: client.name, vendor: client.vendor }
      : { matched: false, name: null, vendor: null },
    user: {
      found: policy.found,
      source: policy.source,
      group: policy.groupName ?? null,
      privilege_level: policy.privilegeLevel,
      is_active: policy.isActive,
      is_expired: policy.isExpired,
    },
    authentication: authenResult,
    shell_authorization: shellAuthor,
    command_authorization: cmdAuthor
      ? {
          command: trimmedCmd,
          allowed: cmdAuthor.allowed,
          reason: cmdAuthor.reason,
        }
      : null,
  };
}

// Re-export protocol helpers used in tests
export {
  buildAcctRequestBody,
  buildAuthenContinueBody,
  buildAuthorRequestBody,
  parseAcctReply,
  parseAuthorResponse,
  TAC_PLUS_ACCT_FLAG,
};

