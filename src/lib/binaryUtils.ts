// Buffer.writeBigUInt64LE / writeBigInt64LE are not exposed by every browser
// polyfill of `node:buffer` (in particular some Next.js bundlers ship an
// older shim). Use these portable byte-by-byte helpers instead so the
// instruction encoders work in every environment we care about.

const ZERO = BigInt(0);
const FF = BigInt(0xff);
const EIGHT = BigInt(8);
// 1n << 64n
const TWO_POW_64 = BigInt("18446744073709551616");

export function u64LE(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  let v = typeof value === "bigint" ? value : BigInt(value);
  if (v < ZERO) {
    throw new Error(`u64LE: value must be non-negative, got ${value}`);
  }
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & FF);
    v = v >> EIGHT;
  }
  return buf;
}

export function i64LE(value: bigint | number): Buffer {
  let v = typeof value === "bigint" ? value : BigInt(value);
  // Encode signed 64-bit as two's-complement unsigned 64-bit.
  if (v < ZERO) {
    v = TWO_POW_64 + v;
  }
  return u64LE(v);
}
