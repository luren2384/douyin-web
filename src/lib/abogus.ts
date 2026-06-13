/**
 * a_bogus 签名算法 - TypeScript 移植版
 * 源自: https://github.com/Evil0ctal/Douyin_TikTok_Download_API
 *       https://github.com/JoeanAmier/TikTokDownloader
 * 算法: SM3 + RC4 + 浏览器指纹
 */

import { sm3Hash } from "./sm3";

const END_STRING = "cus";
const ARGUMENTS = [0, 1, 14];

const STR_MAP: Record<string, string> = {
  s0: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  s1: "Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
  s2: "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
  s3: "ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnry79HbGDaStCe",
  s4: "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe",
};

// 预计算的 UA code（对应 Chrome/90.0.4430.212）
const UA_CODE = [
  76, 98, 15, 131, 97, 245, 224, 133, 122, 199, 241, 166, 79, 34, 90, 191,
  128, 126, 122, 98, 66, 11, 14, 40, 49, 110, 110, 173, 67, 96, 138, 252,
];

const DEFAULT_BROWSER =
  "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel";

function charCodeAt(s: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < s.length; i++) {
    result.push(s.charCodeAt(i));
  }
  return result;
}

function fromCharCode(...codes: number[]): string {
  return codes.map((c) => String.fromCharCode(c & 0xff)).join("");
}

function rotl(e: number, r: number): number {
  r %= 32;
  return ((e << r) & 0xffffffff) | (e >>> (32 - r));
}

function pe(e: number): number {
  return 0 <= e && e < 16 ? 2043430169 : 2055708042;
}

function he(e: number, r: number, t: number, n: number): number {
  if (0 <= e && e < 16) {
    return (r ^ t ^ n) & 0xffffffff;
  }
  return ((r & t) | (r & n) | (t & n)) & 0xffffffff;
}

function ve(e: number, r: number, t: number, n: number): number {
  if (0 <= e && e < 16) {
    return (r ^ t ^ n) & 0xffffffff;
  }
  return ((r & t) | (~r & n)) & 0xffffffff;
}

/**
 * 生成随机列表（对应 Python 的 random_list）
 */
function randomList(
  a: number | null = null,
  b = 170,
  c = 85,
  d = 0,
  e = 0,
  f = 0,
  g = 0
): number[] {
  const r = a ?? Math.random() * 10000;
  const v = [r, Math.floor(r) & 255, Math.floor(r) >> 8];
  let s = (v[1] & b) | d;
  v.push(s);
  s = (v[1] & c) | e;
  v.push(s);
  s = (v[2] & b) | f;
  v.push(s);
  s = (v[2] & c) | g;
  v.push(s);
  return v.slice(-4);
}

function list1(randomNum: number | null = null): number[] {
  return randomList(randomNum, 170, 85, 1, 2, 5, 45 & 170);
}

function list2(randomNum: number | null = null): number[] {
  return randomList(randomNum, 170, 85, 1, 0, 0, 0);
}

function list3(randomNum: number | null = null): number[] {
  return randomList(randomNum, 170, 85, 1, 0, 5, 0);
}

function generateString1(): string {
  return (
    fromCharCode(...list1()) +
    fromCharCode(...list2()) +
    fromCharCode(...list3())
  );
}

/**
 * SM3 杂凑并返回字节数组（对应 sm3_to_array）
 */
function sm3ToArray(data: string | number[]): number[] {
  let bytes: number[];
  if (typeof data === "string") {
    bytes = Array.from(Buffer.from(data, "utf-8"));
  } else {
    bytes = data;
  }
  return sm3Hash(bytes);
}

function generateParamsCode(params: string): number[] {
  return sm3ToArray(sm3ToArray(params + END_STRING));
}

function generateMethodCode(method: string = "GET"): number[] {
  return sm3ToArray(sm3ToArray(method + END_STRING));
}

/**
 * list_4: 构造固定结构数组
 */
function list4(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number,
  j: number,
  k: number,
  m: number,
  n: number,
  o: number,
  p: number,
  q: number,
  r: number
): number[] {
  return [
    44, a, 0, 0, 0, 0, 24, b, n, 0, c, d, 0, 0, 0, 1, 0, 239, e, o, f, g, 0,
    0, 0, 0, h, 0, 0, 14, i, j, 0, k, m, 3, p, 1, q, 1, r, 0, 0, 0,
  ];
}

function endCheckNum(a: number[]): number {
  let r = 0;
  for (const i of a) {
    r ^= i;
  }
  return r;
}

/**
 * RC4 加密（字符串输入输出，对应 abogus 版本）
 */
function rc4EncryptStr(plaintext: string, key: string): string {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let ii = 0;
  let jj = 0;
  const cipher: string[] = [];
  for (let k = 0; k < plaintext.length; k++) {
    ii = (ii + 1) % 256;
    jj = (jj + s[ii]) % 256;
    [s[ii], s[jj]] = [s[jj], s[ii]];
    const t = (s[ii] + s[jj]) % 256;
    cipher.push(String.fromCharCode(s[t] ^ plaintext.charCodeAt(k)));
  }
  return cipher.join("");
}

function generateString2(urlParams: string, method = "GET"): string {
  const startTime = Date.now();
  const endTime = startTime + Math.floor(Math.random() * 5) + 4;

  const paramsArray = generateParamsCode(urlParams);
  const methodArray = generateMethodCode(method);
  const browserCode = charCodeAt(DEFAULT_BROWSER);

  const a = list4(
    (endTime >> 24) & 255,
    paramsArray[21],
    UA_CODE[23],
    (endTime >> 16) & 255,
    paramsArray[22],
    UA_CODE[24],
    (endTime >> 8) & 255,
    (endTime >> 0) & 255,
    (startTime >> 24) & 255,
    (startTime >> 16) & 255,
    (startTime >> 8) & 255,
    (startTime >> 0) & 255,
    methodArray[21],
    methodArray[22],
    Math.floor(endTime / 256 / 256 / 256 / 256) >> 0,
    Math.floor(startTime / 256 / 256 / 256 / 256) >> 0,
    DEFAULT_BROWSER.length
  );

  const e = endCheckNum(a);
  a.push(...browserCode);
  a.push(e);

  return rc4EncryptStr(fromCharCode(...a), "y");
}

/**
 * 生成结果（对应 generate_result，使用 base64 变种编码）
 */
function generateResult(s: string, e = "s4"): string {
  const result: string[] = [];
  for (let i = 0; i < s.length; i += 3) {
    let n: number;
    if (i + 2 < s.length) {
      n =
        ((s.charCodeAt(i) << 16) |
          (s.charCodeAt(i + 1) << 8) |
          s.charCodeAt(i + 2)) >>>
        0;
    } else if (i + 1 < s.length) {
      n = ((s.charCodeAt(i) << 16) | (s.charCodeAt(i + 1) << 8)) >>> 0;
    } else {
      n = (s.charCodeAt(i) << 16) >>> 0;
    }

    const masks: [number, number][] = [
      [18, 0xfc0000],
      [12, 0x03f000],
      [6, 0x0fc0],
      [0, 0x3f],
    ];

    for (const [shift, mask] of masks) {
      if (shift === 6 && i + 1 >= s.length) break;
      if (shift === 0 && i + 2 >= s.length) break;
      result.push(STR_MAP[e][(n & mask) >> shift]);
    }
  }

  const pad = (4 - (result.length % 4)) % 4;
  for (let i = 0; i < pad; i++) result.push("=");

  return result.join("");
}

/**
 * 生成 a_bogus 签名值
 * @param urlParams 参数对象或查询字符串
 * @returns a_bogus 值（未 URL 编码）
 */
export function getABogus(
  urlParams: Record<string, string> | string
): string {
  const paramsStr =
    typeof urlParams === "string"
      ? urlParams
      : new URLSearchParams(urlParams).toString();

  const string1 = generateString1();
  const string2 = generateString2(paramsStr);
  const combined = string1 + string2;
  return generateResult(combined, "s4");
}
