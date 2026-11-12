/** Tohumlu, deterministik rastgelelik (mulberry32). Testlerde aynı tohum aynı sırayı verir. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 0..n-1 sayılarının tohumlu bir permütasyonu. n ≥ 2 için sonuç asla özdeşlik (0,1,2,…) değildir;
 * aksi halde eşleştirmede iki sütun aynı sırada dururdu.
 */
export function seededOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const identity = order.every((v, i) => v === i);
  if (order.length >= 2 && identity) order.push(order.shift() as number);
  return order;
}
