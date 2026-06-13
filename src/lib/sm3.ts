/**
 * SM3 密码杂凑算法 (GB/T 32905-2016)
 * 用于 a_bogus 签名算法
 * 参考: gmssl Python 库的 TypeScript 实现
 */

const IV = [
  1937774191, 1226093241, 388252375, 3666478592, 2842636476, 372324522,
  3817729613, 2969243214,
];

function rotl(x: number, n: number): number {
  n %= 32;
  return ((x << n) & 0xffffffff) | (x >>> (32 - n));
}

function P0(x: number): number {
  return (x ^ rotl(x, 9) ^ rotl(x, 17)) & 0xffffffff;
}

function P1(x: number): number {
  return (x ^ rotl(x, 15) ^ rotl(x, 23)) & 0xffffffff;
}

function FF(j: number, x: number, y: number, z: number): number {
  if (0 <= j && j <= 15) {
    return (x ^ y ^ z) & 0xffffffff;
  }
  return ((x & y) | (x & z) | (y & z)) & 0xffffffff;
}

function GG(j: number, x: number, y: number, z: number): number {
  if (0 <= j && j <= 15) {
    return (x ^ y ^ z) & 0xffffffff;
  }
  return ((x & y) | (~x & z)) & 0xffffffff;
}

const T: number[] = [];
for (let j = 0; j < 64; j++) {
  T[j] = j <= 15 ? 2043430169 : 2055708042;
}

/**
 * 将字节数组填充为 64 字节的分组
 */
function padding(message: number[]): number[] {
  const len = message.length;
  let mlen = len;
  // 追加 0x80
  message.push(0x80);
  // 追加 0 直到长度 ≡ 56 (mod 64)
  while (message.length % 64 !== 56) {
    message.push(0);
  }
  // 追加长度（大端，8 字节）
  const bitLen = mlen * 8;
  // 用 32 位表示高 32 位和低 32 位（这里只用 32 位足够，因为 JS 数组长度限制）
  for (let i = 0; i < 4; i++) {
    message.push(0);
  }
  for (let i = 3; i >= 0; i--) {
    message.push((bitLen >>> (8 * i)) & 0xff);
  }
  return message;
}

/**
 * 压缩函数 CF
 */
function compress(V: number[], B: number[]): number[] {
  const W: number[] = new Array(132).fill(0);
  const W1: number[] = new Array(64).fill(0);

  // 消息扩展: W0..W67
  for (let i = 0; i < 16; i++) {
    W[i] =
      ((B[4 * i] << 24) |
        (B[4 * i + 1] << 16) |
        (B[4 * i + 2] << 8) |
        B[4 * i + 3]) >>>
      0;
  }
  for (let j = 16; j < 68; j++) {
    const x = (W[j - 16] ^ W[j - 9] ^ rotl(W[j - 3], 15)) >>> 0;
    W[j] = (P1(x) ^ rotl(W[j - 13], 7) ^ W[j - 6]) >>> 0;
  }
  // W'0..W63
  for (let j = 0; j < 64; j++) {
    W1[j] = (W[j] ^ W[j + 4]) >>> 0;
  }

  let [A, B1, C, D, E, F, G, H] = V;

  for (let j = 0; j < 64; j++) {
    const SS1 = rotl(
      (rotl(A, 12) + E + rotl(T[j], j % 32)) >>> 0,
      7
    );
    const SS2 = (SS1 ^ rotl(A, 12)) >>> 0;
    const TT1 = (FF(j, A, B1, C) + D + SS2 + W1[j]) >>> 0;
    const TT2 = (GG(j, E, F, G) + H + SS1 + W[j]) >>> 0;
    D = C;
    C = rotl(B1, 9);
    B1 = A;
    A = TT1;
    H = G;
    G = rotl(F, 19);
    F = E;
    E = P0(TT2);
  }

  return [
    (V[0] ^ A) >>> 0,
    (V[1] ^ B1) >>> 0,
    (V[2] ^ C) >>> 0,
    (V[3] ^ D) >>> 0,
    (V[4] ^ E) >>> 0,
    (V[5] ^ F) >>> 0,
    (V[6] ^ G) >>> 0,
    (V[7] ^ H) >>> 0,
  ];
}

/**
 * SM3 杂凑
 * @param input 字节数组
 * @returns 32 字节的杂凑结果
 */
export function sm3Hash(input: number[] | Uint8Array): number[] {
  let data = Array.from(input);
  // 复制避免修改原数组
  data = padding([...data]);

  let V = [...IV];
  for (let i = 0; i < data.length; i += 64) {
    const block = data.slice(i, i + 64);
    V = compress(V, block);
  }

  // 将 V 转为字节数组
  const result: number[] = [];
  for (let i = 0; i < 8; i++) {
    result.push((V[i] >>> 24) & 0xff);
    result.push((V[i] >>> 16) & 0xff);
    result.push((V[i] >>> 8) & 0xff);
    result.push(V[i] & 0xff);
  }
  return result;
}

/**
 * SM3 杂凑并返回十六进制字符串
 */
export function sm3Hex(input: string | number[] | Uint8Array): string {
  let bytes: number[];
  if (typeof input === "string") {
    bytes = Array.from(Buffer.from(input, "utf-8"));
  } else {
    bytes = Array.from(input);
  }
  const hash = sm3Hash(bytes);
  return hash
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
