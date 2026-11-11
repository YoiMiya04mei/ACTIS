import { Client, ConnectConfig } from "ssh2";
import { decryptSecret } from "@/lib/backupCrypto";
import { getVendorProfile } from "@/lib/backupVendorProfiles";

export interface SshDeviceCredentials {
  id: string;
  name: string;
  host: string;
  port: number;
  vendor: string;
  platform?: string | null;
  username?: string | null;
  password_enc?: string | null;
  enable_password_enc?: string | null;
  ssh_private_key_enc?: string | null;
  custom_command?: string | null;
  pre_command?: string | null;
}

export interface SshPullResult {
  config: string;
  commandUsed: string;
  durationMs: number;
}

const SUPPORTED_ALGORITHMS: ConnectConfig["algorithms"] = {
  kex: [
    "curve25519-sha256",
    "curve25519-sha256@libssh.org",
    "ecdh-sha2-nistp256",
    "ecdh-sha2-nistp384",
    "ecdh-sha2-nistp521",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group16-sha512",
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group1-sha1",
  ],
  serverHostKey: [
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
  ],
  cipher: [
    "aes128-gcm@openssh.com",
    "aes256-gcm@openssh.com",
    "aes128-ctr",
    "aes192-ctr",
    "aes256-ctr",
    "aes128-cbc",
    "aes256-cbc",
    "3des-cbc",
  ],
  hmac: [
    "hmac-sha2-256-etm@openssh.com",
    "hmac-sha2-512-etm@openssh.com",
    "hmac-sha2-256",
    "hmac-sha2-512",
    "hmac-sha1",
  ],
};

function stripAnsiAndPager(input: string): string {
  return input
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/----\s*More\s*----[\s\x08]*/gi, "")
    .replace(/--More--[\s\x08]*/gi, "")
    .replace(/---\(more(?:\s+\d+%)?\)---[\s\x08]*/gi, "")
    .replace(/\x08+/g, "");
}

function buildConnectConfig(device: SshDeviceCredentials): ConnectConfig {
  const password = decryptSecret(device.password_enc) || undefined;
  const privateKey = decryptSecret(device.ssh_private_key_enc) || undefined;

  if (!device.username) {
    throw new Error(`Username SSH untuk perangkat '${device.name}' belum diisi.`);
  }
  if (!password && !privateKey) {
    throw new Error(`Password atau SSH Private Key untuk perangkat '${device.name}' belum diisi.`);
  }

  return {
    host: device.host.trim(),
    port: device.port || 22,
    username: device.username.trim(),
    password,
    privateKey,
    readyTimeout: 20000,
    keepaliveInterval: 10000,
    tryKeyboard: true,
    algorithms: SUPPORTED_ALGORITHMS,
  };
}

function resolveCommandConfig(device: SshDeviceCredentials) {
  const profile = getVendorProfile(device.vendor);
  const platformPreset = profile.platforms.find((p) => p.label === device.platform);

  const command =
    device.custom_command?.trim() ||
    platformPreset?.command ||
    profile.defaultCommand;

  const preCommand =
    device.pre_command !== undefined && device.pre_command !== null && device.pre_command.trim() !== ""
      ? device.pre_command.trim()
      : platformPreset?.preCommand ?? profile.defaultPreCommand;

  const execMode =
    device.custom_command?.trim() && profile.id === "mikrotik"
      ? "exec"
      : platformPreset?.execMode || profile.execMode;

  return { profile, command, preCommand, execMode };
}

function connectSshClient(config: ConnectConfig, keyboardPassword?: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(new Error(`Timeout koneksi SSH ke ${config.host}:${config.port} (20 detik).`));
      }
    }, 21000);

    conn
      .on("ready", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(conn);
        }
      })
      .on("keyboard-interactive", (_name, _instr, _lang, prompts, finish) => {
        finish(prompts.map(() => keyboardPassword || ""));
      })
      .on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`Koneksi SSH gagal (${config.host}:${config.port}): ${err.message}`));
        }
      })
      .connect(config);
  });
}

function runExecCommand(conn: Client, command: string, timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error(`Eksekusi perintah '${command}' melebihi batas waktu ${timeoutMs / 1000}s.`));
      }
    }, timeoutMs);

    conn.exec(command, (err, stream) => {
      if (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
        return;
      }

      stream
        .on("close", () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            const cleanedOut = stripAnsiAndPager(stdout).trim();
            const cleanedErr = stripAnsiAndPager(stderr).trim();
            if (!cleanedOut && cleanedErr) {
              reject(new Error(cleanedErr));
              return;
            }
            resolve(cleanedOut || cleanedErr);
          }
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString("utf8");
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString("utf8");
        });
    });
  });
}

function cleanInteractiveCapture(raw: string, command: string): string {
  const cleaned = stripAnsiAndPager(raw);
  const lines = cleaned.split("\n");

  // Drop echoed command line at the very top if present
  while (lines.length > 0) {
    const first = lines[0].trim();
    if (!first || first === command || first.endsWith(command)) {
      lines.shift();
    } else {
      break;
    }
  }

  // Drop trailing device CLI prompt (e.g. "Router#", "<HUAWEI>", "admin@MX240>")
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (
      !last ||
      /^[<\[\w.@()\/:-]+[>#%$]\s*$/.test(last) ||
      last.toLowerCase() === "quit" ||
      last.toLowerCase() === "exit"
    ) {
      lines.pop();
    } else {
      break;
    }
  }

  return lines.join("\n").trim();
}

function runInteractiveShell(
  conn: Client,
  params: {
    preCommands: string[];
    command: string;
    enablePassword?: string | null;
    timeoutMs?: number;
  }
): Promise<string> {
  const timeoutMs = params.timeoutMs || 65000;

  return new Promise((resolve, reject) => {
    conn.shell({ term: "vt100", rows: 500, cols: 240 }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let rawBuffer = "";
      let captureStartIdx = -1;
      let stage: "INIT" | "ENABLE_PW" | "PRE_CMDS" | "MAIN_CMD" | "DONE" = "INIT";
      let preCmdIdx = 0;
      let idleTimer: NodeJS.Timeout | null = null;
      let settled = false;

      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer);
        clearTimeout(overallTimer);
      };

      const finishSuccess = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          stream.write("\nquit\nexit\n");
          stream.end();
        } catch {}
        const slice = captureStartIdx >= 0 ? rawBuffer.slice(captureStartIdx) : rawBuffer;
        resolve(cleanInteractiveCapture(slice, params.command));
      };

      const overallTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          try {
            stream.end();
          } catch {}
          reject(new Error(`Timeout menarik konfigurasi dari shell SSH (${timeoutMs / 1000} detik).`));
        }
      }, timeoutMs);

      const resetMainIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        const delay = stage === "MAIN_CMD" ? 2200 : 800;
        idleTimer = setTimeout(() => {
          if (settled) return;

          if (stage === "INIT") {
            const tail = stripAnsiAndPager(rawBuffer).slice(-120).trim();
            if (params.enablePassword && tail.endsWith(">")) {
              stage = "ENABLE_PW";
              stream.write("enable\n");
              return;
            }
            stage = "PRE_CMDS";
          }

          if (stage === "ENABLE_PW") {
            stage = "PRE_CMDS";
          }

          if (stage === "PRE_CMDS") {
            if (preCmdIdx < params.preCommands.length) {
              const cmd = params.preCommands[preCmdIdx++];
              stream.write(`${cmd}\n`);
              resetMainIdleTimer();
              return;
            }
            stage = "MAIN_CMD";
            captureStartIdx = rawBuffer.length;
            stream.write(`${params.command}\n`);
            resetMainIdleTimer();
            return;
          }

          if (stage === "MAIN_CMD") {
            stage = "DONE";
            finishSuccess();
          }
        }, delay);
      };

      stream.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        rawBuffer += text;
        const recent = stripAnsiAndPager(rawBuffer.slice(-200));

        // Handle enable password prompt
        if (stage === "ENABLE_PW" && /password[:\s]*$/i.test(recent.trim())) {
          stream.write(`${params.enablePassword || ""}\n`);
          stage = "PRE_CMDS";
          resetMainIdleTimer();
          return;
        }

        // Handle pager prompts automatically just in case paging wasn't disabled
        if (/(----\s*more\s*----|--more--|---\(more(?:\s+\d+%)?\)---)\s*$/i.test(recent.trim())) {
          stream.write(" ");
          resetMainIdleTimer();
          return;
        }

        // Auto-proceed on prompt detection after main command outputs lines
        if (
          stage === "MAIN_CMD" &&
          captureStartIdx >= 0 &&
          rawBuffer.length - captureStartIdx > params.command.length + 20 &&
          /\n[^\n]{1,64}[>#]\s*$/.test(stripAnsiAndPager(rawBuffer.slice(-140)))
        ) {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            if (!settled && stage === "MAIN_CMD") {
              stage = "DONE";
              finishSuccess();
            }
          }, 600);
          return;
        }

        resetMainIdleTimer();
      });

      stream.on("close", () => {
        if (!settled) {
          finishSuccess();
        }
      });

      stream.on("error", (streamErr: Error) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(streamErr);
        }
      });

      // Kick off initial wait if banner arrives quietly
      resetMainIdleTimer();
    });
  });
}

function validatePulledConfig(output: string, vendor: string) {
  const trimmed = output.trim();
  if (!trimmed || trimmed.length < 15) {
    throw new Error("Output konfigurasi kosong atau terlalu pendek dari perangkat.");
  }

  const lower = trimmed.toLowerCase();
  if (
    trimmed.length < 300 &&
    (lower.includes("syntax error") ||
      lower.includes("invalid input detected") ||
      lower.includes("unrecognized command") ||
      lower.includes("permission denied"))
  ) {
    throw new Error(`Perangkat menolak perintah backup (${vendor}): ${trimmed.slice(0, 180)}`);
  }
}

export async function pullDeviceConfigViaSsh(device: SshDeviceCredentials): Promise<SshPullResult> {
  const startedAt = Date.now();
  const connectCfg = buildConnectConfig(device);
  const plainPassword = decryptSecret(device.password_enc) || undefined;
  const enablePassword = decryptSecret(device.enable_password_enc) || undefined;
  const { profile, command, preCommand, execMode } = resolveCommandConfig(device);

  const conn = await connectSshClient(connectCfg, plainPassword);
  try {
    let config = "";
    let commandUsed = command;

    if (execMode === "exec") {
      try {
        config = await runExecCommand(conn, commandUsed);
        validatePulledConfig(config, profile.id);
      } catch (err: any) {
        // MikroTik ROS v6 fallback if '/export show-sensitive' isn't supported
        if (
          profile.id === "mikrotik" &&
          !device.custom_command?.trim() &&
          commandUsed.includes("show-sensitive")
        ) {
          commandUsed = "/export";
          config = await runExecCommand(conn, commandUsed);
          validatePulledConfig(config, profile.id);
        } else {
          throw err;
        }
      }
    } else {
      const preCommands = preCommand
        ? preCommand
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      config = await runInteractiveShell(conn, {
        preCommands,
        command: commandUsed,
        enablePassword,
      });
      validatePulledConfig(config, profile.id);
    }

    return {
      config,
      commandUsed,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    conn.end();
  }
}

export async function testDeviceSshConnection(
  device: SshDeviceCredentials
): Promise<{ success: boolean; durationMs: number; message: string; preview?: string }> {
  const startedAt = Date.now();
  const connectCfg = buildConnectConfig(device);
  const plainPassword = decryptSecret(device.password_enc) || undefined;

  const conn = await connectSshClient(connectCfg, plainPassword);
  try {
    const profile = getVendorProfile(device.vendor);
    let preview = "";

    // Quick verification command where safe
    if (profile.id === "mikrotik") {
      try {
        preview = await runExecCommand(conn, "/system identity print", 10000);
      } catch {
        preview = "SSH authenticated (RouterOS)";
      }
    } else {
      preview = `SSH authenticated ke ${device.host}:${device.port}`;
    }

    return {
      success: true,
      durationMs: Date.now() - startedAt,
      message: `Koneksi SSH berhasil ke ${device.host}:${device.port} (${Date.now() - startedAt} ms).`,
      preview: preview.slice(0, 300),
    };
  } finally {
    conn.end();
  }
}

