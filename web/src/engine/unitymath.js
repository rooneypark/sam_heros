// Unity-compatible math helpers.

// Mathf.PerlinNoise — native libunity implementation (icall @0xef9b0 -> Noise @0x747f44):
// improved Perlin noise on |x|,|y| with Ken Perlin's permutation, normalized as (n + 0.69) / 1.483 (no clamp).
const P = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99,
  37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177,
  33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158,
  231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
  1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198,
  173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47,
  16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43,
  172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242,
  193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106,
  157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141,
  128, 195, 78, 66, 215, 61, 156, 180];
const PP = new Int32Array(512);
for (let i = 0; i < 512; i++) PP[i] = P[i & 255];
const f32 = Math.fround;

function grad(hash, x, y) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : ((h | 2) === 14 ? x : 0);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise(x, y) {
  x = Math.abs(x); y = Math.abs(y);
  const xi = Math.trunc(x), yi = Math.trunc(y);
  const X = xi & 255, Y = yi & 255;
  x = f32(x - xi); y = f32(y - yi);
  const fx = Math.min(x, 1), fy = Math.min(y, 1);
  const u = f32(fx * fx * fx * (fx * (fx * 6 - 15) + 10));
  const v = f32(fy * fy * fy * (fy * (fy * 6 - 15) + 10));
  const A = PP[X] + Y, AA = PP[A], AB = PP[A + 1];
  const B = PP[X + 1] + Y, BA = PP[B], BB = PP[B + 1];
  const x1 = x - 1, y1 = y - 1;
  const l0 = grad(PP[AA], x, y), l1 = grad(PP[BA], x1, y);
  const l2 = grad(PP[AB], x, y1), l3 = grad(PP[BB], x1, y1);
  const a = l0 + u * (l1 - l0);
  const b = l2 + u * (l3 - l2);
  return f32(a + v * (b - a));
}

export function perlinNoise(x, y) {
  return f32((noise(f32(x), f32(y)) + f32(0.69)) / f32(1.483));
}

// UnityEngine.Random: xorshift128 seeded like Unity (InitState).
export class URandom {
  constructor(seed = (Date.now() & 0x7fffffff)) { this.initState(seed); }
  initState(seed) {
    this.s0 = seed >>> 0;
    this.s1 = Math.imul(1812433253, this.s0) + 1 >>> 0;
    this.s2 = Math.imul(1812433253, this.s1) + 1 >>> 0;
    this.s3 = Math.imul(1812433253, this.s2) + 1 >>> 0;
  }
  nextU32() {
    let t = this.s0 ^ (this.s0 << 11);
    this.s0 = this.s1; this.s1 = this.s2; this.s2 = this.s3;
    this.s3 = (this.s3 ^ (this.s3 >>> 19)) ^ (t ^ (t >>> 8));
    return this.s3 >>> 0;
  }
  get value() { return (this.nextU32() & 0x7fffff) / 8388607; }
  /** Random.Range(float, float): inclusive */
  range(min, max) { return min + (max - min) * this.value; }
  /** Random.Range(int, int): max exclusive (returns min when max <= min) */
  rangeInt(min, max) {
    if (max <= min) return min;
    return min + (this.nextU32() % (max - min));
  }
}

export const Random = new URandom();

export const Mathf = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  clamp01: v => (v < 0 ? 0 : v > 1 ? 1 : v),
  lerp: (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1),
  moveTowards(cur, target, maxDelta) { return Math.abs(target - cur) <= maxDelta ? target : cur + Math.sign(target - cur) * maxDelta; },
  floorToInt: v => Math.floor(v),
  roundToInt(v) { // banker's rounding like Mathf.RoundToInt
    const f = Math.floor(v), d = v - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  },
};
