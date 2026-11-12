import crypto from "crypto";

// ============================================================================
// RFC 8907 TACACS+ PROTOCOL CONSTANTS & WIRE FORMAT CODEC
// ============================================================================

export const TAC_PLUS_HEADER_SIZE = 12;
export const TAC_PLUS_MAX_PACKET_BODY = 65535;

export const TAC_PLUS_MAJOR_VER = 0xc;
export const TAC_PLUS_MINOR_VER_DEFAULT = 0x0;
export const TAC_PLUS_MINOR_VER_ONE = 0x1;

export const TAC_PLUS_VER_DEFAULT = (TAC_PLUS_MAJOR_VER << 4) | TAC_PLUS_MINOR_VER_DEFAULT; // 0xc0
export const TAC_PLUS_VER_ONE = (TAC_PLUS_MAJOR_VER << 4) | TAC_PLUS_MINOR_VER_ONE; // 0xc1

export const TAC_PLUS_TYPE = {
  AUTHEN: 0x01,
  AUTHOR: 0x02,
  ACCT: 0x03,
} as const;

export const TAC_PLUS_FLAGS = {
  UNENCRYPTED: 0x01,
  SINGLE_CONNECT: 0x04,
} as const;

// Authentication action
export const TAC_PLUS_AUTHEN_ACTION = {
  LOGIN: 0x01,
  CHPASS: 0x02,
  SENDAUTH: 0x04,
} as const;

// Authentication type
export const TAC_PLUS_AUTHEN_TYPE = {
  ASCII: 0x01,
  PAP: 0x02,
  CHAP: 0x03,
  ARAP: 0x04,
  MSCHAP: 0x05,
  MSCHAPV2: 0x06,
} as const;

// Authentication service
export const TAC_PLUS_AUTHEN_SVC = {
  NONE: 0x00,
  LOGIN: 0x01,
  ENABLE: 0x02,
  PPP: 0x03,
  PT: 0x05,
  RCMD: 0x06,
  X25: 0x07,
  NASI: 0x08,
} as const;

// Authentication reply status
export const TAC_PLUS_AUTHEN_STATUS = {
  PASS: 0x01,
  FAIL: 0x02,
  GETDATA: 0x03,
  GETUSER: 0x04,
  GETPASS: 0x05,
  RESTART: 0x06,
  ERROR: 0x07,
  FOLLOW: 0x21,
} as const;

export const TAC_PLUS_REPLY_FLAG_NOECHO = 0x01;
export const TAC_PLUS_CONTINUE_FLAG_ABORT = 0x01;

// Authorization status
export const TAC_PLUS_AUTHOR_STATUS = {
  PASS_ADD: 0x01,
  PASS_REPL: 0x02,
  FAIL: 0x10,
  ERROR: 0x11,
  FOLLOW: 0x21,
} as const;

// Accounting flags
export const TAC_PLUS_ACCT_FLAG = {
  START: 0x02,
  STOP: 0x04,
  WATCHDOG: 0x08,
} as const;

// Accounting status
export const TAC_PLUS_ACCT_STATUS = {
  SUCCESS: 0x01,
  ERROR: 0x02,
  FOLLOW: 0x21,
} as const;

export interface TacacsHeader {
  version: number;
  majorVersion: number;
  minorVersion: number;
  type: number;
  seqNo: number;
  flags: number;
  sessionId: number;
  length: number;
}

export interface TacacsAuthenStart {
  action: number;
  privLvl: number;
  authenType: number;
  authenService: number;
  user: string;
  port: string;
  remAddr: string;
  data: Buffer;
}

export interface TacacsAuthenContinue {
  flags: number;
  userMsg: string;
  data: Buffer;
}

export interface TacacsAuthorRequest {
  authenMethod: number;
  privLvl: number;
  authenType: number;
  authenService: number;
  user: string;
  port: string;
  remAddr: string;
  args: string[];
}

export interface TacacsAcctRequest {
  flags: number;
  authenMethod: number;
  privLvl: number;
  authenType: number;
  authenService: number;
  user: string;
  port: string;
  remAddr: string;
  args: string[];
}

export function parseTacacsHeader(buf: Buffer): TacacsHeader {
  if (buf.length < TAC_PLUS_HEADER_SIZE) {
    throw new Error(`Invalid TACACS+ header length: ${buf.length}`);
  }
  const version = buf.readUInt8(0);
  return {
    version,
    majorVersion: (version >> 4) & 0x0f,
    minorVersion: version & 0x0f,
    type: buf.readUInt8(1),
    seqNo: buf.readUInt8(2),
    flags: buf.readUInt8(3),
    sessionId: buf.readUInt32BE(4),
    length: buf.readUInt32BE(8),
  };
}

export function buildTacacsHeader(params: {
  version?: number;
  type: number;
  seqNo: number;
  flags?: number;
  sessionId: number;
  length: number;
}): Buffer {
  const buf = Buffer.alloc(TAC_PLUS_HEADER_SIZE);
  buf.writeUInt8(params.version ?? TAC_PLUS_VER_DEFAULT, 0);
  buf.writeUInt8(params.type, 1);
  buf.writeUInt8(params.seqNo, 2);
  buf.writeUInt8(params.flags ?? 0, 3);
  buf.writeUInt32BE(params.sessionId >>> 0, 4);
  buf.writeUInt32BE(params.length >>> 0, 8);
  return buf;
}

/**
 * RFC 8907 Section 4.5 Body Obfuscation (symmetric XOR with chained MD5 pseudo-pad).
 * MD5_1 = MD5(session_id (4B BE) + key + version (1B) + seq_no (1B))
 * MD5_i = MD5(session_id (4B BE) + key + version (1B) + seq_no (1B) + MD5_{i-1})
 */
export function obfuscateTacacsBody(
  body: Buffer,
  secretKey: string,
  sessionId: number,
  version: number,
  seqNo: number
): Buffer {
  if (body.length === 0) return Buffer.alloc(0);

  const sessionBuf = Buffer.alloc(4);
  sessionBuf.writeUInt32BE(sessionId >>> 0, 0);
  const keyBuf = Buffer.from(secretKey, "utf8");
  const verSeqBuf = Buffer.from([version & 0xff, seqNo & 0xff]);

  const out = Buffer.alloc(body.length);
  let prevDigest: Buffer | null = null;
  let offset = 0;

  while (offset < body.length) {
    const hash = crypto.createHash("md5");
    hash.update(sessionBuf);
    hash.update(keyBuf);
    hash.update(verSeqBuf);
    if (prevDigest) {
      hash.update(prevDigest);
    }
    const digest = hash.digest();
    prevDigest = digest;

    const chunkLen = Math.min(16, body.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      out[offset + i] = body[offset + i] ^ digest[i];
    }
    offset += chunkLen;
  }

  return out;
}

export function encodeTacacsPacket(params: {
  version?: number;
  type: number;
  seqNo: number;
  flags?: number;
  sessionId: number;
  body: Buffer;
  secretKey?: string;
}): Buffer {
  const version = params.version ?? TAC_PLUS_VER_DEFAULT;
  const flags = params.flags ?? 0;
  const isUnencrypted = (flags & TAC_PLUS_FLAGS.UNENCRYPTED) !== 0;

  const wireBody =
    isUnencrypted || !params.secretKey
      ? params.body
      : obfuscateTacacsBody(params.body, params.secretKey, params.sessionId, version, params.seqNo);

  const header = buildTacacsHeader({
    version,
    type: params.type,
    seqNo: params.seqNo,
    flags,
    sessionId: params.sessionId,
    length: wireBody.length,
  });

  return Buffer.concat([header, wireBody]);
}

export function parseAuthenStart(body: Buffer): TacacsAuthenStart {
  if (body.length < 8) {
    throw new Error(`AUTHEN START body too short: ${body.length}`);
  }
  const action = body.readUInt8(0);
  const privLvl = body.readUInt8(1);
  const authenType = body.readUInt8(2);
  const authenService = body.readUInt8(3);
  const userLen = body.readUInt8(4);
  const portLen = body.readUInt8(5);
  const remAddrLen = body.readUInt8(6);
  const dataLen = body.readUInt8(7);

  const expected = 8 + userLen + portLen + remAddrLen + dataLen;
  if (body.length < expected) {
    throw new Error(`AUTHEN START truncated: got ${body.length}, expected ${expected}`);
  }

  let cursor = 8;
  const user = body.subarray(cursor, cursor + userLen).toString("utf8");
  cursor += userLen;
  const port = body.subarray(cursor, cursor + portLen).toString("utf8");
  cursor += portLen;
  const remAddr = body.subarray(cursor, cursor + remAddrLen).toString("utf8");
  cursor += remAddrLen;
  const data = body.subarray(cursor, cursor + dataLen);

  return { action, privLvl, authenType, authenService, user, port, remAddr, data };
}

export function buildAuthenStartBody(params: {
  action: number;
  privLvl: number;
  authenType: number;
  authenService: number;
  user?: string;
  port?: string;
  remAddr?: string;
  data?: Buffer | string;
}): Buffer {
  const userBuf = Buffer.from(params.user ?? "", "utf8");
  const portBuf = Buffer.from(params.port ?? "", "utf8");
  const remAddrBuf = Buffer.from(params.remAddr ?? "", "utf8");
  const dataBuf =
    typeof params.data === "string"
      ? Buffer.from(params.data, "utf8")
      : params.data ?? Buffer.alloc(0);

  const head = Buffer.alloc(8);
  head.writeUInt8(params.action & 0xff, 0);
  head.writeUInt8(params.privLvl & 0xff, 1);
  head.writeUInt8(params.authenType & 0xff, 2);
  head.writeUInt8(params.authenService & 0xff, 3);
  head.writeUInt8(userBuf.length & 0xff, 4);
  head.writeUInt8(portBuf.length & 0xff, 5);
  head.writeUInt8(remAddrBuf.length & 0xff, 6);
  head.writeUInt8(dataBuf.length & 0xff, 7);

  return Buffer.concat([head, userBuf, portBuf, remAddrBuf, dataBuf]);
}

export function parseAuthenContinue(body: Buffer): TacacsAuthenContinue {
  if (body.length < 5) {
    throw new Error(`AUTHEN CONTINUE body too short: ${body.length}`);
  }
  const userMsgLen = body.readUInt16BE(0);
  const dataLen = body.readUInt16BE(2);
  const flags = body.readUInt8(4);

  const expected = 5 + userMsgLen + dataLen;
  if (body.length < expected) {
    throw new Error(`AUTHEN CONTINUE truncated: got ${body.length}, expected ${expected}`);
  }

  const userMsg = body.subarray(5, 5 + userMsgLen).toString("utf8");
  const data = body.subarray(5 + userMsgLen, 5 + userMsgLen + dataLen);

  return { flags, userMsg, data };
}

export function buildAuthenContinueBody(params: {
  userMsg?: string;
  data?: Buffer;
  flags?: number;
}): Buffer {
  const msgBuf = Buffer.from(params.userMsg ?? "", "utf8");
  const dataBuf = params.data ?? Buffer.alloc(0);
  const head = Buffer.alloc(5);
  head.writeUInt16BE(msgBuf.length, 0);
  head.writeUInt16BE(dataBuf.length, 2);
  head.writeUInt8(params.flags ?? 0, 4);
  return Buffer.concat([head, msgBuf, dataBuf]);
}

export function buildAuthenReplyBody(params: {
  status: number;
  flags?: number;
  serverMsg?: string;
  data?: Buffer;
}): Buffer {
  const msgBuf = Buffer.from(params.serverMsg ?? "", "utf8");
  const dataBuf = params.data ?? Buffer.alloc(0);
  const head = Buffer.alloc(6);
  head.writeUInt8(params.status & 0xff, 0);
  head.writeUInt8((params.flags ?? 0) & 0xff, 1);
  head.writeUInt16BE(msgBuf.length, 2);
  head.writeUInt16BE(dataBuf.length, 4);
  return Buffer.concat([head, msgBuf, dataBuf]);
}

export function parseAuthenReply(body: Buffer): {
  status: number;
  flags: number;
  serverMsg: string;
  data: Buffer;
} {
  if (body.length < 6) {
    throw new Error(`AUTHEN REPLY too short: ${body.length}`);
  }
  const status = body.readUInt8(0);
  const flags = body.readUInt8(1);
  const serverMsgLen = body.readUInt16BE(2);
  const dataLen = body.readUInt16BE(4);
  const serverMsg = body.subarray(6, 6 + serverMsgLen).toString("utf8");
  const data = body.subarray(6 + serverMsgLen, 6 + serverMsgLen + dataLen);
  return { status, flags, serverMsg, data };
}

export function parseAuthorRequest(body: Buffer): TacacsAuthorRequest {
  if (body.length < 8) {
    throw new Error(`AUTHOR REQUEST body too short: ${body.length}`);
  }
  const authenMethod = body.readUInt8(0);
  const privLvl = body.readUInt8(1);
  const authenType = body.readUInt8(2);
  const authenService = body.readUInt8(3);
  const userLen = body.readUInt8(4);
  const portLen = body.readUInt8(5);
  const remAddrLen = body.readUInt8(6);
  const argCnt = body.readUInt8(7);

  let cursor = 8;
  if (body.length < cursor + argCnt) {
    throw new Error(`AUTHOR REQUEST missing arg lengths`);
  }
  const argLens: number[] = [];
  for (let i = 0; i < argCnt; i++) {
    argLens.push(body.readUInt8(cursor + i));
  }
  cursor += argCnt;

  const totalVarLen =
    userLen + portLen + remAddrLen + argLens.reduce((acc, n) => acc + n, 0);
  if (body.length < cursor + totalVarLen) {
    throw new Error(`AUTHOR REQUEST truncated`);
  }

  const user = body.subarray(cursor, cursor + userLen).toString("utf8");
  cursor += userLen;
  const port = body.subarray(cursor, cursor + portLen).toString("utf8");
  cursor += portLen;
  const remAddr = body.subarray(cursor, cursor + remAddrLen).toString("utf8");
  cursor += remAddrLen;

  const args: string[] = [];
  for (const len of argLens) {
    args.push(body.subarray(cursor, cursor + len).toString("utf8"));
    cursor += len;
  }

  return { authenMethod, privLvl, authenType, authenService, user, port, remAddr, args };
}

export function buildAuthorRequestBody(params: {
  authenMethod?: number;
  privLvl?: number;
  authenType?: number;
  authenService?: number;
  user?: string;
  port?: string;
  remAddr?: string;
  args: string[];
}): Buffer {
  const userBuf = Buffer.from(params.user ?? "", "utf8");
  const portBuf = Buffer.from(params.port ?? "", "utf8");
  const remAddrBuf = Buffer.from(params.remAddr ?? "", "utf8");
  const argBufs = params.args.map((a) => Buffer.from(a, "utf8"));

  const head = Buffer.alloc(8 + argBufs.length);
  head.writeUInt8(params.authenMethod ?? 0x06, 0); // TAC_PLUS_AUTHEN_METH_TACACSPLUS
  head.writeUInt8(params.privLvl ?? 1, 1);
  head.writeUInt8(params.authenType ?? TAC_PLUS_AUTHEN_TYPE.ASCII, 2);
  head.writeUInt8(params.authenService ?? TAC_PLUS_AUTHEN_SVC.LOGIN, 3);
  head.writeUInt8(userBuf.length & 0xff, 4);
  head.writeUInt8(portBuf.length & 0xff, 5);
  head.writeUInt8(remAddrBuf.length & 0xff, 6);
  head.writeUInt8(argBufs.length & 0xff, 7);
  argBufs.forEach((b, idx) => head.writeUInt8(b.length & 0xff, 8 + idx));

  return Buffer.concat([head, userBuf, portBuf, remAddrBuf, ...argBufs]);
}

export function buildAuthorResponseBody(params: {
  status: number;
  args?: string[];
  serverMsg?: string;
  data?: Buffer;
}): Buffer {
  const args = params.args ?? [];
  const argBufs = args.map((a) => Buffer.from(a, "utf8"));
  const msgBuf = Buffer.from(params.serverMsg ?? "", "utf8");
  const dataBuf = params.data ?? Buffer.alloc(0);

  const head = Buffer.alloc(6 + argBufs.length);
  head.writeUInt8(params.status & 0xff, 0);
  head.writeUInt8(argBufs.length & 0xff, 1);
  head.writeUInt16BE(msgBuf.length, 2);
  head.writeUInt16BE(dataBuf.length, 4);
  argBufs.forEach((b, idx) => head.writeUInt8(b.length & 0xff, 6 + idx));

  return Buffer.concat([head, msgBuf, dataBuf, ...argBufs]);
}

export function parseAuthorResponse(body: Buffer): {
  status: number;
  serverMsg: string;
  data: Buffer;
  args: string[];
} {
  if (body.length < 6) {
    throw new Error(`AUTHOR RESPONSE too short: ${body.length}`);
  }
  const status = body.readUInt8(0);
  const argCnt = body.readUInt8(1);
  const msgLen = body.readUInt16BE(2);
  const dataLen = body.readUInt16BE(4);
  let cursor = 6;
  const argLens: number[] = [];
  for (let i = 0; i < argCnt; i++) {
    argLens.push(body.readUInt8(cursor + i));
  }
  cursor += argCnt;
  const serverMsg = body.subarray(cursor, cursor + msgLen).toString("utf8");
  cursor += msgLen;
  const data = body.subarray(cursor, cursor + dataLen);
  cursor += dataLen;
  const args: string[] = [];
  for (const len of argLens) {
    args.push(body.subarray(cursor, cursor + len).toString("utf8"));
    cursor += len;
  }
  return { status, serverMsg, data, args };
}

export function parseAcctRequest(body: Buffer): TacacsAcctRequest {
  if (body.length < 9) {
    throw new Error(`ACCT REQUEST body too short: ${body.length}`);
  }
  const flags = body.readUInt8(0);
  const authenMethod = body.readUInt8(1);
  const privLvl = body.readUInt8(2);
  const authenType = body.readUInt8(3);
  const authenService = body.readUInt8(4);
  const userLen = body.readUInt8(5);
  const portLen = body.readUInt8(6);
  const remAddrLen = body.readUInt8(7);
  const argCnt = body.readUInt8(8);

  let cursor = 9;
  if (body.length < cursor + argCnt) {
    throw new Error(`ACCT REQUEST missing arg lengths`);
  }
  const argLens: number[] = [];
  for (let i = 0; i < argCnt; i++) {
    argLens.push(body.readUInt8(cursor + i));
  }
  cursor += argCnt;

  const totalVarLen =
    userLen + portLen + remAddrLen + argLens.reduce((acc, n) => acc + n, 0);
  if (body.length < cursor + totalVarLen) {
    throw new Error(`ACCT REQUEST truncated`);
  }

  const user = body.subarray(cursor, cursor + userLen).toString("utf8");
  cursor += userLen;
  const port = body.subarray(cursor, cursor + portLen).toString("utf8");
  cursor += portLen;
  const remAddr = body.subarray(cursor, cursor + remAddrLen).toString("utf8");
  cursor += remAddrLen;

  const args: string[] = [];
  for (const len of argLens) {
    args.push(body.subarray(cursor, cursor + len).toString("utf8"));
    cursor += len;
  }

  return { flags, authenMethod, privLvl, authenType, authenService, user, port, remAddr, args };
}

export function buildAcctRequestBody(params: {
  flags: number;
  authenMethod?: number;
  privLvl?: number;
  authenType?: number;
  authenService?: number;
  user?: string;
  port?: string;
  remAddr?: string;
  args: string[];
}): Buffer {
  const userBuf = Buffer.from(params.user ?? "", "utf8");
  const portBuf = Buffer.from(params.port ?? "", "utf8");
  const remAddrBuf = Buffer.from(params.remAddr ?? "", "utf8");
  const argBufs = params.args.map((a) => Buffer.from(a, "utf8"));

  const head = Buffer.alloc(9 + argBufs.length);
  head.writeUInt8(params.flags & 0xff, 0);
  head.writeUInt8(params.authenMethod ?? 0x06, 1);
  head.writeUInt8(params.privLvl ?? 15, 2);
  head.writeUInt8(params.authenType ?? TAC_PLUS_AUTHEN_TYPE.ASCII, 3);
  head.writeUInt8(params.authenService ?? TAC_PLUS_AUTHEN_SVC.LOGIN, 4);
  head.writeUInt8(userBuf.length & 0xff, 5);
  head.writeUInt8(portBuf.length & 0xff, 6);
  head.writeUInt8(remAddrBuf.length & 0xff, 7);
  head.writeUInt8(argBufs.length & 0xff, 8);
  argBufs.forEach((b, idx) => head.writeUInt8(b.length & 0xff, 9 + idx));

  return Buffer.concat([head, userBuf, portBuf, remAddrBuf, ...argBufs]);
}

export function buildAcctReplyBody(params: {
  status: number;
  serverMsg?: string;
  data?: Buffer;
}): Buffer {
  const msgBuf = Buffer.from(params.serverMsg ?? "", "utf8");
  const dataBuf = params.data ?? Buffer.alloc(0);
  const head = Buffer.alloc(5);
  head.writeUInt16BE(msgBuf.length, 0);
  head.writeUInt16BE(dataBuf.length, 2);
  head.writeUInt8(params.status & 0xff, 4);
  return Buffer.concat([head, msgBuf, dataBuf]);
}

export function parseAcctReply(body: Buffer): {
  status: number;
  serverMsg: string;
  data: Buffer;
} {
  if (body.length < 5) {
    throw new Error(`ACCT REPLY too short: ${body.length}`);
  }
  const msgLen = body.readUInt16BE(0);
  const dataLen = body.readUInt16BE(2);
  const status = body.readUInt8(4);
  const serverMsg = body.subarray(5, 5 + msgLen).toString("utf8");
  const data = body.subarray(5 + msgLen, 5 + msgLen + dataLen);
  return { status, serverMsg, data };
}

export function authenTypeLabel(authenType: number, authenService?: number): string {
  if (authenService === TAC_PLUS_AUTHEN_SVC.ENABLE) return "ENABLE";
  switch (authenType) {
    case TAC_PLUS_AUTHEN_TYPE.ASCII:
      return "ASCII";
    case TAC_PLUS_AUTHEN_TYPE.PAP:
      return "PAP";
    case TAC_PLUS_AUTHEN_TYPE.CHAP:
      return "CHAP";
    case TAC_PLUS_AUTHEN_TYPE.MSCHAP:
      return "MSCHAP";
    case TAC_PLUS_AUTHEN_TYPE.MSCHAPV2:
      return "MSCHAPV2";
    default:
      return `TYPE_${authenType}`;
  }
}

export function acctFlagsLabel(flags: number): "START" | "STOP" | "UPDATE" {
  if ((flags & TAC_PLUS_ACCT_FLAG.START) !== 0) return "START";
  if ((flags & TAC_PLUS_ACCT_FLAG.STOP) !== 0) return "STOP";
  return "UPDATE";
}

