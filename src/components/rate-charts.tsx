'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
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

/* ============================== Types ============================== */

export type CurvePoint = { util: number; rate: number }

export type RateSeries = {
    title: string
    color: string
    // Prefer full curves when available:
    borrowCurve?: CurvePoint[] | null
    lendCurve?: CurvePoint[] | null
    // Fallback (constant lines):
    borrowRatePct?: number | null
    lendRatePct?: number | null
    // Hints for defaults
    protocol?: string
    currentUtilPct?: number | null
    targetUtilPct?: number | null
}

type Props = {
    series: [RateSeries, RateSeries]
    className?: string
    /** Optional initial range, overrides auto-Marginfi defaults */
    defaultRange?: [number, number]
}

/* ============================== Helpers ============================== */

const STEP = 0.01
const MIN_GAP = 0.01

const clamp = (x: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : lo))

const normalizeCurve = (curve: CurvePoint[]): CurvePoint[] => {
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

/** Build a merged dataset sampled each 1% so tooltip tracks smoothly */
const buildMergedData = (
    s0: RateSeries,
    s1: RateSeries,
    step = 1
): Array<{ util: number; b0?: number | null; l0?: number | null; b1?: number | null; l1?: number | null }> => {
    const data = []
    for (let u = 0; u <= 100; u += step) {
        const b0 = s0.borrowCurve ? valueAt(s0.borrowCurve, u) : (s0.borrowRatePct ?? null)
        const l0 = s0.lendCurve ? valueAt(s0.lendCurve, u) : (s0.lendRatePct ?? null)
        const b1 = s1.borrowCurve ? valueAt(s1.borrowCurve, u) : (s1.borrowRatePct ?? null)
        const l1 = s1.lendCurve ? valueAt(s1.lendCurve, u) : (s1.lendRatePct ?? null)
        data.push({ util: u, b0, l0, b1, l1 })
    }
    return data
}

/* ============================== UI Bits ============================== */

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

/* ============================== Component ============================== */

const RateCharts: React.FC<Props> = ({ series, className, defaultRange }) => {
    const [s0, s1] = series

    // Full merged data across 0..100 (stable, cheap)
    const mergedData = useMemo(() => buildMergedData(s0, s1, 1), [s0, s1])

    // ---- Compute defaults (Marginfi-based) unless defaultRange is supplied ----
    const autoDefault: [number, number] = useMemo(() => {
        // find Marginfi series (by protocol or title)
        const m =
            [s0, s1].find(
                (s) => (s.protocol ?? s.title).toLowerCase().startsWith('marginfi')
            ) ?? s0
        const cur = typeof m.currentUtilPct === 'number' ? m.currentUtilPct! : 0
        const tgt = typeof m.targetUtilPct === 'number' ? m.targetUtilPct! : 0
        const upper = clamp(Math.max(cur, tgt), 0, 100)
        const lower = clamp(0.5 * Math.min(cur, tgt), 0, upper - MIN_GAP)
        return [lower, upper]
    }, [s0, s1])

    const initial: [number, number] = (defaultRange ?? autoDefault).slice(0, 2) as [number, number]

    // RANGE CONTROL: staged = UI, applied = chart
    const [staged, setStaged] = useState<[number, number]>([
        clamp(initial[0], 0, 100),
        clamp(initial[1], 0, 100),
    ])
    const [applied, setApplied] = useState<[number, number]>([
        Math.min(staged[0], staged[1]),
        Math.max(staged[0], staged[1]),
    ])

    // If series/defaults change (e.g., user picks different rows), reset to new auto defaults
    useEffect(() => {
        const lo = clamp(initial[0], 0, 100)
        const hi = clamp(initial[1], 0, 100)
        setStaged([lo, hi])
        setApplied([lo, hi])
    }, [initial[0], initial[1]])

    const commitRange = useCallback(() => {
        setApplied(([prevLo, prevHi]) => {
            const lo = clamp(staged[0], 0, 100)
            const hi = clamp(staged[1], 0, 100)
            if (lo === prevLo && hi === prevHi) return [prevLo, prevHi]
            return [lo, hi]
        })
    }, [staged])

    // Button state:
    const dirty =
        Math.abs(staged[0] - applied[0]) > 1e-9 || Math.abs(staged[1] - applied[1]) > 1e-9

    // Inputs: enforce lower < upper by MIN_GAP
    const setLowerFromInput = (val: number) => {
        const hi = staged[1]
        let lo = clamp(val, 0, hi - MIN_GAP)
        if (lo >= hi) lo = clamp(hi - MIN_GAP, 0, hi - MIN_GAP)
        setStaged([Number(lo.toFixed(2)), hi])
    }
    const setUpperFromInput = (val: number) => {
        const lo = staged[0]
        let hi = clamp(val, lo + MIN_GAP, 100)
        if (hi <= lo) hi = clamp(lo + MIN_GAP, lo + MIN_GAP, 100)
        setStaged([lo, Number(hi.toFixed(2))])
    }

    // Sliders (two separate, small bars)
    const setLowerFromSlider = (val: number) => {
        const hi = staged[1]
        const lo = clamp(val, 0, hi - MIN_GAP)
        setStaged([Number(lo.toFixed(2)), staged[1]])
    }
    const setUpperFromSlider = (val: number) => {
        const lo = staged[0]
        const hi = clamp(val, lo + MIN_GAP, 100)
        setStaged([staged[0], Number(hi.toFixed(2))])
    }

    // Data in applied window
    const visibleData = useMemo(
        () => mergedData.filter(d => d.util >= applied[0] && d.util <= applied[1]),
        [mergedData, applied]
    )



    return (
        <div className={className ?? ''}>
            {/* Controls (inputs + redraw) */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <button
                    onClick={commitRange}
                    className={[
                        'px-3 py-2 rounded-md text-white transition',
                        dirty ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700' : 'invisible',
                    ].join(' ')}
                    type="button"
                >
                    Redraw Graph
                </button>

                <label className="text-sm flex items-center gap-2">
                    Lower Limit:
                    <input
                        type="number"
                        step={STEP}
                        min={0}
                        max={staged[1] - MIN_GAP}
                        value={staged[0]}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            setLowerFromInput(Number.isFinite(v) ? v : 0)
                        }}
                        className="w-24 rounded-md border px-2 py-1"
                    />
                </label>
                <label className="text-sm flex items-center gap-2">
                    Upper Limit:
                    <input
                        type="number"
                        step={STEP}
                        min={staged[0] + MIN_GAP}
                        max={100}
                        value={staged[1]}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            setUpperFromInput(Number.isFinite(v) ? v : 100)
                        }}
                        className="w-24 rounded-md border px-2 py-1"
                    />
                </label>
            </div>

            {/* Small bars on a single line, aligned with chart's left boundary */}
            <div className="mb-4">
                <div className="px-0 pr-[220px]">
                    <div className="flex items-start gap-8">
                        {/* Lower slider: from left boundary, compact bar */}
                        <div>
                            <div className="text-xs text-gray-600 mb-1">Lower Limit</div>
                            <div className="relative h-6 w-72">
                                <div className="pointer-events-none z-0 absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 rounded bg-gray-300" />
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, staged[1] - MIN_GAP)}
                                    step={STEP}
                                    value={staged[0]}
                                    onChange={(e) => setLowerFromSlider(parseFloat(e.target.value))}
                                    className={[
                                        'absolute left-0 top-0 h-6 w-72 appearance-none bg-transparent outline-none z-10',
                                        '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent',
                                        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer',
                                        '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600',
                                    ].join(' ')}
                                />
                            </div>
                            <div className="mt-1 text-xs text-gray-600">{staged[0].toFixed(2)}%</div>
                        </div>

                        {/* Upper slider: same size bar, positioned under the “Upper Limit” label */}
                        <div className="ml-[1.6rem]">
                            <div className="text-xs text-gray-600 mb-1">Upper Limit</div>
                            <div className="relative h-6 w-72">
                                <div className="pointer-events-none z-0 absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 rounded bg-gray-300" />
                                <input
                                    type="range"
                                    min={Math.min(100, staged[0] + MIN_GAP)}
                                    max={100}
                                    step={STEP}
                                    value={staged[1]}
                                    onChange={(e) => setUpperFromSlider(parseFloat(e.target.value))}
                                    className={[
                                        'absolute left-0 top-0 h-6 w-72 appearance-none bg-transparent outline-none z-10',
                                        '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent',
                                        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer',
                                        '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600',
                                    ].join(' ')}
                                />
                            </div>
                            <div className="mt-1 text-xs text-gray-600">{staged[1].toFixed(2)}%</div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Chart */}
            <div className="rounded-2xl border p-4 shadow-sm">
                <div className="relative h-96 pr-[220px]">
                    {/* Legends outside plot */}
                    <div className="absolute right-2 top-2 z-10" style={{ maxWidth: 220 }}>
                        <BoxedLegend items={[{ label: s0.title, color: s0.color }, { label: s1.title, color: s1.color }]} title="Borrow" />
                    </div>
                    <div className="absolute right-2 bottom-2 z-10" style={{ maxWidth: 220 }}>
                        <BoxedLegend items={[{ label: s0.title, color: s0.color }, { label: s1.title, color: s1.color }]} dashed title="Lend" />
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={visibleData} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                dataKey="util"
                                domain={[applied[0], applied[1]]}
                                label={{ value: 'Utilization', position: 'insideBottom', offset: -2 }}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <YAxis
                                type="number"
                                domain={[0, 'auto']}
                                label={{ value: 'Rate', angle: -90, position: 'insideLeft' }}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1.25} />
                            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.25} />
                            <Tooltip
                                wrapperStyle={{ fontSize: 12 }}
                                contentStyle={{ padding: '6px 8px', borderRadius: 8 }}
                                labelStyle={{ fontSize: 12, marginBottom: 4 }}
                                itemStyle={{ fontSize: 12, padding: 0 }}
                                formatter={(value: any, name: string) => [`${value}%`, name]}
                                labelFormatter={(label: any) => `Utilization: ${label}%`}
                            />
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
