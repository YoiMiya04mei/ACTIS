import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import {
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
  TAC_PLUS_HEADER_SIZE,
  TAC_PLUS_TYPE,
  TAC_PLUS_VER_DEFAULT,
} from "../src/lib/tacacs/protocol.ts";
import {
  evaluateCommandAuthorization,
  extractArgsMetadata,
  generateVendorCliSnippet,
  isValidIpOrCidr,
  matchIpOrCidr,
  normalizeIpAddress,
} from "../src/lib/tacacs/policy.ts";

async function main() {
  console.log("=== TACACS+ RFC 8907 Protocol & Policy Tests ===");

  // 1. MD5 Pseudo-Pad Obfuscation Symmetry (RFC 8907 Section 4.5)
  const secret = "SuperSecretTacacsKey123!";
  const sessionId = 0xdeadbeef;
  const plain = Buffer.from("Hello TACACS+ RFC 8907 Multi-Block Payload Test > 16 bytes!", "utf8");
  const encrypted = obfuscateTacacsBody(plain, secret, sessionId, TAC_PLUS_VER_DEFAULT, 1);
  assert.notDeepEqual(encrypted, plain, "Encrypted body must differ from plaintext");
  const decrypted = obfuscateTacacsBody(encrypted, secret, sessionId, TAC_PLUS_VER_DEFAULT, 1);
  assert.deepEqual(decrypted, plain, "Decrypted body must match original plaintext");

  // 2. Authen START / CONTINUE / REPLY roundtrip
  const startBody = buildAuthenStartBody({
    action: TAC_PLUS_AUTHEN_ACTION.LOGIN,
    privLvl: 15,
    authenType: TAC_PLUS_AUTHEN_TYPE.PAP,
    authenService: TAC_PLUS_AUTHEN_SVC.LOGIN,
    user: "noc_budi",
    port: "tty0",
    remAddr: "10.20.30.40",
    data: "MyPassword!@#",
  });
  const startPkt = encodeTacacsPacket({
    type: TAC_PLUS_TYPE.AUTHEN,
    seqNo: 1,
    sessionId,
    body: startBody,
    secretKey: secret,
  });
  const hdr1 = parseTacacsHeader(startPkt);
  assert.equal(hdr1.majorVersion, 0x0c);
  assert.equal(hdr1.type, TAC_PLUS_TYPE.AUTHEN);
  assert.equal(hdr1.seqNo, 1);
  assert.equal(hdr1.sessionId, sessionId >>> 0);
  const decStartBody = obfuscateTacacsBody(
    startPkt.subarray(TAC_PLUS_HEADER_SIZE),
    secret,
    hdr1.sessionId,
    hdr1.version,
    hdr1.seqNo
  );
  const parsedStart = parseAuthenStart(decStartBody);
  assert.equal(parsedStart.user, "noc_budi");
  assert.equal(parsedStart.port, "tty0");
  assert.equal(parsedStart.remAddr, "10.20.30.40");
  assert.equal(parsedStart.data.toString("utf8"), "MyPassword!@#");

  const contBody = buildAuthenContinueBody({ userMsg: "SecretPass99" });
  const parsedCont = parseAuthenContinue(contBody);
  assert.equal(parsedCont.userMsg, "SecretPass99");

  const replyBody = buildAuthenReplyBody({
    status: TAC_PLUS_AUTHEN_STATUS.PASS,
    serverMsg: "Welcome NOC",
  });
  const parsedReply = parseAuthenReply(replyBody);
  assert.equal(parsedReply.status, TAC_PLUS_AUTHEN_STATUS.PASS);
  assert.equal(parsedReply.serverMsg, "Welcome NOC");
  console.log("[PASS] RFC 8907 MD5 obfuscation & Authen packets");

  // 3. Author REQUEST / RESPONSE & AV-Pair extraction
  const authorReqBody = buildAuthorRequestBody({
    user: "noc_budi",
    port: "vty0",
    remAddr: "192.168.10.5",
    args: ["service=shell", "cmd=show", "cmd-arg=ip", "cmd-arg=bgp", "cmd-arg=<cr>"],
  });
  const parsedAuthorReq = parseAuthorRequest(authorReqBody);
  assert.equal(parsedAuthorReq.user, "noc_budi");
  assert.equal(parsedAuthorReq.args.length, 5);

  const meta = extractArgsMetadata(parsedAuthorReq.args);
  assert.equal(meta.service, "shell");
  assert.equal(meta.isShellLogin, false);
  assert.equal(meta.fullCommand, "show ip bgp");

  const authorRespBody = buildAuthorResponseBody({
    status: TAC_PLUS_AUTHOR_STATUS.PASS_ADD,
    args: ["priv-lvl=7", "Mikrotik-Group=write"],
  });
  const parsedAuthorResp = parseAuthorResponse(authorRespBody);
  assert.equal(parsedAuthorResp.status, TAC_PLUS_AUTHOR_STATUS.PASS_ADD);
  assert.deepEqual(parsedAuthorResp.args, ["priv-lvl=7", "Mikrotik-Group=write"]);
  console.log("[PASS] Authorization packet & command AV-pair extraction");

  // 4. Accounting REQUEST / REPLY
  const acctReqBody = buildAcctRequestBody({
    flags: TAC_PLUS_ACCT_FLAG.STOP,
    user: "noc_budi",
    port: "vty0",
    remAddr: "192.168.10.5",
    args: ["task_id=42", "service=shell", "elapsed_time=18", "cmd=configure", "cmd-arg=terminal"],
  });
  const parsedAcctReq = parseAcctRequest(acctReqBody);
  const acctMeta = extractArgsMetadata(parsedAcctReq.args);
  assert.equal(acctMeta.elapsedSec, 18);
  assert.equal(acctMeta.fullCommand, "configure terminal");

  const acctReply = parseAcctReply(
    buildAcctReplyBody({ status: TAC_PLUS_ACCT_STATUS.SUCCESS, serverMsg: "OK" })
  );
  assert.equal(acctReply.status, TAC_PLUS_ACCT_STATUS.SUCCESS);
  console.log("[PASS] Accounting packet encode/decode");

  // 5. IP / CIDR & Command Authorization Policy
  assert.equal(normalizeIpAddress("::ffff:10.10.1.5"), "10.10.1.5");
  assert.equal(isValidIpOrCidr("10.10.0.0/24"), true);
  assert.equal(isValidIpOrCidr("999.1.1.1"), false);
  assert.equal(matchIpOrCidr("::ffff:10.10.1.55", "10.10.1.0/24"), true);
  assert.equal(matchIpOrCidr("10.10.2.55", "10.10.1.0/24"), false);
  assert.equal(matchIpOrCidr("172.16.5.4", "0.0.0.0/0"), true);

  const rules = [
    { id: "1", action: "deny", pattern: "^(reload|reboot|write erase)" },
    { id: "2", action: "permit", pattern: "^(show|display|ping)" },
  ];
  assert.equal(
    evaluateCommandAuthorization({
      fullCommand: "show ip route",
      rules,
      defaultPolicy: "deny",
    }).allowed,
    true
  );
  assert.equal(
    evaluateCommandAuthorization({
      fullCommand: "reload in 5",
      rules,
      defaultPolicy: "permit",
    }).allowed,
    false
  );
  assert.equal(
    evaluateCommandAuthorization({
      fullCommand: "configure terminal",
      rules,
      defaultPolicy: "deny",
    }).allowed,
    false
  );
  console.log("[PASS] CIDR matching & command authorization rules");

  // 6. Vendor CLI Snippet Generator
  const cisco = generateVendorCliSnippet({
    vendor: "cisco",
    serverIp: "10.0.0.10",
    port: 49,
    sharedSecret: "KEY123",
  });
  assert.ok(cisco.includes("tacacs server ACTIS_TACACS") && cisco.includes("key KEY123"));
  const huawei = generateVendorCliSnippet({
    vendor: "huawei",
    serverIp: "10.0.0.10",
    port: 49,
    sharedSecret: "KEY123",
  });
  assert.ok(huawei.includes("hwtacacs-server template actis_tacacs"));
  console.log("[PASS] Vendor CLI snippet generation");

  // 7. Live TCP Socket Roundtrip Test (Obfuscated RFC 8907 Wire Exchange)
  const wireSecret = "WireRoundtripKey";
  const server = net.createServer((sock) => {
    sock.on("data", (chunk) => {
      const hdr = parseTacacsHeader(chunk);
      const body = obfuscateTacacsBody(
        chunk.subarray(TAC_PLUS_HEADER_SIZE, TAC_PLUS_HEADER_SIZE + hdr.length),
        wireSecret,
        hdr.sessionId,
        hdr.version,
        hdr.seqNo
      );
      const start = parseAuthenStart(body);
      const ok = start.user === "admin" && start.data.toString("utf8") === "pass123";
      const resp = encodeTacacsPacket({
        version: hdr.version,
        type: hdr.type,
        seqNo: hdr.seqNo + 1,
        sessionId: hdr.sessionId,
        body: buildAuthenReplyBody({
          status: ok ? TAC_PLUS_AUTHEN_STATUS.PASS : TAC_PLUS_AUTHEN_STATUS.FAIL,
          serverMsg: ok ? "OK" : "NO",
        }),
        secretKey: wireSecret,
      });
      sock.write(resp);
    });
  });

  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();

    const clientReply = await new Promise((resolve, reject) => {
      const sid = crypto.randomBytes(4).readUInt32BE(0);
      const sock = net.createConnection({ host: "127.0.0.1", port: addr.port }, () => {
        const pkt = encodeTacacsPacket({
          type: TAC_PLUS_TYPE.AUTHEN,
          seqNo: 1,
          sessionId: sid,
          body: buildAuthenStartBody({
            action: TAC_PLUS_AUTHEN_ACTION.LOGIN,
            privLvl: 15,
            authenType: TAC_PLUS_AUTHEN_TYPE.PAP,
            authenService: TAC_PLUS_AUTHEN_SVC.LOGIN,
            user: "admin",
            data: "pass123",
          }),
          secretKey: wireSecret,
        });
        sock.write(pkt);
      });
      sock.on("data", (chunk) => {
        const hdr = parseTacacsHeader(chunk);
        const body = obfuscateTacacsBody(
          chunk.subarray(TAC_PLUS_HEADER_SIZE),
          wireSecret,
          hdr.sessionId,
          hdr.version,
          hdr.seqNo
        );
        const rep = parseAuthenReply(body);
        sock.end();
        resolve(rep);
      });
      sock.on("error", reject);
    });

    assert.equal(clientReply.status, TAC_PLUS_AUTHEN_STATUS.PASS);
    assert.equal(clientReply.serverMsg, "OK");
    console.log("[PASS] Live TCP RFC 8907 wire roundtrip");
  } catch (err) {
    if (err?.code === "EACCES") {
      console.log("[SKIP] Live TCP loopback skipped due to sandbox socket restriction (EACCES)");
    } else {
      throw err;
    }
  } finally {
    server.close();
  }
  console.log("=== ALL TACACS+ PROTOCOL TESTS PASSED ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

