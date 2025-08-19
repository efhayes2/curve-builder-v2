export type CurvePoint = { util: number; rate: number }

export const clamp = (x: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : lo))

/** Sort by util (0..100), clamp range, and de-dupe equal utils (last wins). */
export function normalizeCurve(curve: CurvePoint[]): CurvePoint[] {
    const pts = curve
        .map(p => ({ util: clamp(p.util, 0, 100), rate: p.rate }))
        .sort((a, b) => a.util - b.util)

    const out: CurvePoint[] = []
    for (const p of pts) {
        if (out.length && out[out.length - 1].util === p.util) out[out.length - 1] = p
        else out.push(p)
    }
    return out
}

/** Linear interpolate (or clamp) the curve at a specific util ∈ [0,100]. */
export function valueAt(curve: CurvePoint[], util: number): number {
    const pts = normalizeCurve(curve)
    if (util <= pts[0].util) return pts[0].rate
    if (util >= pts[pts.length - 1].util) return pts[pts.length - 1].rate
    let lo = 0
    let hi = pts.length - 1
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (pts[mid].util <= util) lo = mid
        else hi = mid
    }
    const a = pts[lo], b = pts[hi]
    const t = (util - a.util) / Math.max(1e-9, (b.util - a.util))
    return a.rate + t * (b.rate - a.rate)
}
