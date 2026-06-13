/**
 * X-Bogus 签名算法 - TypeScript 移植版
 * 源自: https://github.com/Evil0ctal/Douyin_TikTok_Download_API
 * 算法: MD5 + RC4
 */

import crypto from "crypto";

const CHARACTER = "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=";

// 十六进制字符到数值的映射表（对应 Python 版的 self.Array）
const HEX_ARRAY: (number | null)[] = (() => {
  const arr: (number | null)[] = new Array(128).fill(null);
  for (let i = 0; i < 10; i++) arr[48 + i] = i; // '0'-'9'
  for (let i = 0; i < 6; i++) arr[97 + i] = 10 + i; // 'a'-'f'
  return arr;
})();

function md5Hex(data: Buffer | string | number[]): string {
  const buf = Array.isArray(data) ? Buffer.from(data) : data;
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * 将字符串（可能是 hex 字符串或普通字符串）转为字节数组
 * 对应 Python 的 md5_str_to_array
 */
function md5StrToArray(md5Str: string): number[] {
  if (md5Str.length > 32) {
    return Array.from(Buffer.from(md5Str, "latin1"));
  }
  const array: number[] = [];
  let idx = 0;
  while (idx < md5Str.length) {
    const hi = HEX_ARRAY[md5Str.charCodeAt(idx)] ?? 0;
    const lo = HEX_ARRAY[md5Str.charCodeAt(idx + 1)] ?? 0;
    array.push(((hi << 4) | lo) & 0xff);
    idx += 2;
  }
  return array;
}

/**
 * 多轮 MD5 加密 URL path
 */
function md5Encrypt(urlPath: string): number[] {
  const h1 = md5Hex(urlPath);
  const arr1 = md5StrToArray(h1);
  const h2 = md5Hex(Buffer.from(arr1));
  return md5StrToArray(h2);
}

/**
 * RC4 加密
 */
function rc4Encrypt(key: Buffer, data: Buffer): Buffer {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const result: number[] = [];
  let ii = 0;
  let jj = 0;
  for (let k = 0; k < data.length; k++) {
    const byte = data[k];
    ii = (ii + 1) % 256;
    jj = (jj + S[ii]) % 256;
    [S[ii], S[jj]] = [S[jj], S[ii]];
    result.push(byte ^ S[(S[ii] + S[jj]) % 256]);
  }
  return Buffer.from(result);
}

/**
 * 编码转换（对应 encoding_conversion）
 * 参数顺序: a, b, c, e, d, t, f, r, n, o, i, _, x, u, s, l, v, h, p
 */
function encodingConversion(
  a: number,
  b: number,
  c: number,
  e: number,
  d: number,
  t: number,
  f: number,
  r: number,
  n: number,
  o: number,
  i: number,
  _: number,
  x: number,
  u: number,
  s: number,
  l: number,
  v: number,
  h: number,
  p: number
): Buffer {
  const y: number[] = [a];
  y.push(i);
  y.push(b, _, c, x, e, u, d, s, t, l, f, v, r, h, n, p, o);
  return Buffer.from(y);
}

function encodingConversion2(a: number, b: number, c: Buffer): string {
  return String.fromCharCode(a) + String.fromCharCode(b) + c.toString("latin1");
}

function calculation(a: number, b: number, c: number): string {
  const x1 = (a & 255) << 16;
  const x2 = (b & 255) << 8;
  const x3 = x1 | x2 | c;
  return (
    CHARACTER[(x3 & 16515072) >> 18] +
    CHARACTER[(x3 & 258048) >> 12] +
    CHARACTER[(x3 & 4032) >> 6] +
    CHARACTER[x3 & 63]
  );
}

/**
 * 生成 X-Bogus 签名
 * @param urlPath 完整的请求参数字符串（如 "device_platform=webapp&aid=6383&..."）
 * @param userAgent User-Agent
 * @returns [完整参数字符串, X-Bogus值]
 */
export function getXBogus(
  urlPath: string,
  userAgent: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
): [string, string] {
  const uaKey = Buffer.from([0x00, 0x01, 0x0c]);

  // array1: RC4(UA) -> base64 -> md5 -> str_to_array
  const uaEncrypted = rc4Encrypt(
    uaKey,
    Buffer.from(userAgent, "latin1")
  );
  const uaBase64 = uaEncrypted.toString("base64");
  const array1 = md5StrToArray(md5Hex(uaBase64));

  // array2: md5 of empty string hash
  const array2 = md5StrToArray(
    md5Hex(md5StrToArray("d41d8cd98f00b204e9800998ecf8427e"))
  );

  const urlPathArray = md5Encrypt(urlPath);

  const timer = Math.floor(Date.now() / 1000);
  const ct = 536919696;

  const newArray: number[] = [
    64, 0.00390625, 1, 12,
    urlPathArray[14], urlPathArray[15], array2[14], array2[15],
    array1[14], array1[15],
    (timer >> 24) & 255, (timer >> 16) & 255, (timer >> 8) & 255, timer & 255,
    (ct >> 24) & 255, (ct >> 16) & 255, (ct >> 8) & 255, ct & 255,
  ];

  let xorResult = newArray[0];
  for (let i = 1; i < newArray.length; i++) {
    let b = newArray[i];
    if (typeof b === "number" && !Number.isInteger(b)) {
      b = Math.floor(b);
    }
    xorResult ^= b as number;
  }
  newArray.push(xorResult);

  // 拆分为奇数位和偶数位
  const array3: number[] = [];
  const array4: number[] = [];
  for (let idx = 0; idx < newArray.length; idx += 2) {
    array3.push(newArray[idx]);
    if (idx + 1 < newArray.length) {
      array4.push(newArray[idx + 1]);
    }
  }

  const mergeArray = [...array3, ...array4];
  const encoded = encodingConversion(...(mergeArray as [
    number, number, number, number, number, number, number, number,
    number, number, number, number, number, number, number, number,
    number, number, number
  ]));

  const ffKey = Buffer.from([0xff]); // "ÿ" in latin1
  const garbledBytes = rc4Encrypt(ffKey, encoded);
  const garbledCode = encodingConversion2(
    2,
    255,
    garbledBytes
  );

  let xb = "";
  let idx = 0;
  while (idx < garbledCode.length) {
    xb += calculation(
      garbledCode.charCodeAt(idx),
      garbledCode.charCodeAt(idx + 1),
      garbledCode.charCodeAt(idx + 2)
    );
    idx += 3;
  }

  const params = `${urlPath}&X-Bogus=${xb}`;
  return [params, xb];
}
