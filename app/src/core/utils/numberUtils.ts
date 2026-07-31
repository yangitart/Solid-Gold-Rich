// Pure utility functions for number formatting and progression calculations.
// These have no dependencies on game constants, allowing constants to use them
// without creating circular dependencies.

export function fmtNum(n: number): string {
  const neg = n < 0 ? "-" : ""
  let v = Math.abs(n)
  if (v < 1000) return `${neg}${Math.floor(v)}`
  const units = ["k", "M", "B", "T", "Q"]
  let u = -1
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000
    u++
  }
  const txt = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
  return `${neg}${parseFloat(txt)}${units[u]}`
}

export function extendLimits(
  start: number[],
  growth: number,
  upToRank: number,
  hardCap: number,
): number[] {
  const out = [...start]
  while (out.length <= upToRank)
    out.push(Math.min(hardCap, Math.round(out[out.length - 1] * growth)))
  return out
}
