'use client'

import React, { useMemo } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts'

export type CurvePoint = { util: number; rate: number }

export type RateSeries = {
    title: string           // e.g., "Kamino_SOL"
    color: string           // shared for borrow (solid) + lend (dashed)
    borrowCurve?: CurvePoint[] | null
    lendCurve?: CurvePoint[] | null
    borrowRatePct?: number | null   // fallback constant line (e.g., 7.2)
    lendRatePct?: number | null
}

type Props = {
    series: [RateSeries, RateSeries]
    className?: string
}

/* ---------- Legends (boxed) ---------- */

const BoxedLegend: React.FC<{
    items: { label: string; color: string }[]
    dashed?: boolean
    title?: string
}> = ({ items, dashed, title }) => {
    return (
        <div
            style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 8,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                minWidth: 140,
            }}
            className="text-sm"
        >
            {title && <div className="mb-2 font-medium opacity-80">{title}</div>}
            <div className="flex flex-col gap-2">
                {items.map((it) => (
                    <div key={it.label} className="flex items-center gap-2">
                        {dashed ? (
                            <span
                                style={{
                                    borderBottom: `2px dashed ${it.color}`,
                                    width: 18,
                                    display: 'inline-block',
                                    height: 0,
                                }}
                            />
                        ) : (
                            <span
                                style={{
                                    background: it.color,
                                    width: 18,
                                    height: 2,
                                    display: 'inline-block',
                                }}
                            />
                        )}
                        <span>{it.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ---------- Data helpers ---------- */

const normalizeCurve = (curve: CurvePoint[]): CurvePoint[] => {
    const pts = curve
        .map(p => ({ util: Math.min(100, Math.max(0, p.util)), rate: p.rate }))
        .sort((a, b) => a.util - b.util)
    const out: CurvePoint[] = []
    for (const p of pts) {
        if (out.length && out[out.length - 1].util === p.util) out[out.length - 1] = p
        else out.push(p)
    }
    return out
}

const valueAt = (curve: CurvePoint[] | null | undefined, util: number): number | null => {
    if (!curve || curve.length === 0) return null
    const pts = normalizeCurve(curve)
    if (util <= pts[0].util) return pts[0].rate
    if (util >= pts[pts.length - 1].util) return pts[pts.length - 1].rate
    let lo = 0, hi = pts.length - 1
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (pts[mid].util <= util) lo = mid
        else hi = mid
    }
    const a = pts[lo], b = pts[hi]
    const t = (util - a.util) / Math.max(1e-9, (b.util - a.util))
    return a.rate + t * (b.rate - a.rate)
}

const makeConstLine = (ratePct: number): CurvePoint[] => [
    { util: 0, rate: ratePct },
    { util: 100, rate: ratePct },
]

const buildMergedData = (
    s0: RateSeries,
    s1: RateSeries,
    step = 1
): Array<{ util: number; b0?: number | null; l0?: number | null; b1?: number | null; l1?: number | null }> => {
    const data = []
    for (let u = 0; u <= 100; u += step) {
        const b0 = s0.borrowCurve ? valueAt(s0.borrowCurve, u) : (s0.borrowRatePct ?? null)
        const l0 = s0.lendCurve   ? valueAt(s0.lendCurve, u)   : (s0.lendRatePct ?? null)
        const b1 = s1.borrowCurve ? valueAt(s1.borrowCurve, u) : (s1.borrowRatePct ?? null)
        const l1 = s1.lendCurve   ? valueAt(s1.lendCurve, u)   : (s1.lendRatePct ?? null)
        data.push({ util: u, b0, l0, b1, l1 })
    }
    return data
}

/* ---------- Component ---------- */

const RateCharts: React.FC<Props> = ({ series, className }) => {
    const [s0, s1] = series

    // Smooth tooltip: sample every 1% along X so values track mouse X instead of snapping.
    const mergedData = useMemo(() => buildMergedData(s0, s1, 1), [s0, s1])

    // Legends (labels are market titles; boxes already say Borrow/Lend)
    const borrowItems = [
        { label: s0.title, color: s0.color },
        { label: s1.title, color: s1.color },
    ]
    const lendItems = [
        { label: s0.title, color: s0.color },
        { label: s1.title, color: s1.color },
    ]

    return (
        <div className={className ?? ''}>
            <div className="rounded-2xl border p-4 shadow-sm">
                {/* Right-side buffer to host legends outside the plot area */}
                <div className="relative h-96 pr-[220px]">
                    {/* UPPER RIGHT: Borrows (solid) */}
                    <div className="absolute right-2 top-2 z-10" style={{ maxWidth: 220 }}>
                        <BoxedLegend items={borrowItems} title="Borrow" />
                    </div>

                    {/* LOWER RIGHT: Lends (dashed) */}
                    <div className="absolute right-2 bottom-2 z-10" style={{ maxWidth: 220 }}>
                        <BoxedLegend items={lendItems} dashed title="Lend" />
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mergedData} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" />

                            {/* Axes anchored at lower-left (0%,0%) */}
                            <XAxis
                                type="number"
                                dataKey="util"
                                domain={[0, 100]}
                                label={{ value: 'Utilization', position: 'insideBottom', offset: -2 }}
                                tickFormatter={(v) => `${v}%`}
                                allowDataOverflow={false}
                            />
                            <YAxis
                                type="number"
                                domain={[0, 'auto']}
                                label={{ value: 'Rate', angle: -90, position: 'insideLeft' }}
                                tickFormatter={(v) => `${v}%`}
                                allowDataOverflow={false}
                            />

                            {/* Origin lines at (0,0) */}
                            <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1.25} />
                            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.25} />

                            {/* Slimmer tooltip */}
                            <Tooltip
                                wrapperStyle={{ fontSize: 12 }}
                                contentStyle={{ padding: '6px 8px', borderRadius: 8 }}
                                labelStyle={{ fontSize: 12, marginBottom: 4 }}
                                itemStyle={{ fontSize: 12, padding: 0 }}
                                formatter={(value: any, name: string) => [`${value}%`, name]}
                                labelFormatter={(label: any) => `Utilization: ${label}%`}
                            />

                            {/* Four lines */}
                            <Line name={`${s0.title} Borrow`} type="linear" dataKey="b0" dot={false} stroke={s0.color} strokeWidth={2} isAnimationActive={false} />
                            <Line name={`${s0.title} Lend`}   type="linear" dataKey="l0" dot={false} stroke={s0.color} strokeDasharray="6 6" strokeWidth={2} isAnimationActive={false} />
                            <Line name={`${s1.title} Borrow`} type="linear" dataKey="b1" dot={false} stroke={s1.color} strokeWidth={2} isAnimationActive={false} />
                            <Line name={`${s1.title} Lend`}   type="linear" dataKey="l1" dot={false} stroke={s1.color} strokeDasharray="6 6" strokeWidth={2} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}

export default RateCharts
