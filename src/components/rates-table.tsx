'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import RateCharts, { RateSeries } from '@/components/rate-charts'
import { ProtocolDataRow } from '@/lib/types'
import {
    formatRow,
    FormattedDataRow,
    computeCoupledSelections,
    MarketOption,
} from '@/lib/utils'

type Props = {
    data: ProtocolDataRow[] // rows may include { curves?: { util:number[]; borrow:number[]; lend:number[] } }
    onRowChange?: (rowIndex: number, selection: ProtocolDataRow) => void
}

const makeKey = (r: { protocol: string; token: string }) => `${r.protocol}_${r.token}`

/** Parse "12.3%" | "12.3 %" | 0.123 → 12.3 */
const parsePercent = (val?: string | number | null): number | null => {
    if (val == null) return null
    if (typeof val === 'number') return val * 100
    const m = String(val).match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
}

// Chart colors: Row 1 (blue), Row 2 (orange)
const ROW_COLORS: [string, string] = ['#2563eb', '#f97316']

/** Default first selection = marginfi_<alphabetically-first-token>, else first option */
function pickDefaultFirstKey(options: MarketOption[]): string {
    const marginfi = options.filter(o => o.protocol.toLowerCase() === 'marginfi')
    if (marginfi.length) {
        const sorted = [...marginfi].sort((a, b) =>
            a.token.localeCompare(b.token, undefined, { sensitivity: 'base' })
        )
        return sorted[0].key
    }
    return options[0]?.key ?? ''
}

/** Adapt {util[], borrow[], lend[]} -> chart curves; clamps util to [0,100] and aligns lengths */
function vectorsToCurves(v?: { knots: number[]; borrowRates: number[]; lendingRates: number[] } | null) {
    if (!v) return { borrowCurve: null as any, lendCurve: null as any }
    const n = Math.min(v.knots.length, v.borrowRates.length, v.lendingRates.length)
    const borrowCurve = new Array<{ util: number; rate: number }>(n)
    const lendCurve = new Array<{ util: number; rate: number }>(n)
    for (let i = 0; i < n; i++) {
        const u = Math.max(0, Math.min(100, v.knots[i]))
        borrowCurve[i] = { util: u, rate: v.borrowRates[i] }
        lendCurve[i] = { util: u, rate: v.lendingRates[i] }
    }
    return { borrowCurve, lendCurve }
}

export const RatesTable = ({ data, onRowChange }: Props) => {
    // Unique (protocol, token) options
    const options: MarketOption[] = useMemo(() => {
        const seen = new Set<string>()
        const list: MarketOption[] = []
        for (const r of data) {
            const key = makeKey(r)
            if (!seen.has(key)) {
                seen.add(key)
                list.push({ key, protocol: r.protocol, token: r.token, row: r })
            }
        }
        return list
    }, [data])

    // Defaults: row 0 marginfi_<first token>; row 1 via coupling helper
    const defaultSelections: [string, string] = useMemo(() => {
        if (options.length === 0) return ['', '']
        const firstKey = pickDefaultFirstKey(options)
        return computeCoupledSelections(options, ['', ''], 0, firstKey)
    }, [options])

    const [selections, setSelections] = useState<[string, string]>(defaultSelections)

    // Keep selections valid when options change
    useEffect(() => {
        setSelections(prev => {
            const keySet = new Set(options.map(o => o.key))
            const missing0 = prev[0] && !keySet.has(prev[0])
            const missing1 = prev[1] && !keySet.has(prev[1])
            const bothEmpty = !prev[0] && !prev[1]
            return (bothEmpty || missing0 || missing1) ? defaultSelections : prev
        })
    }, [defaultSelections, options])

    // Look up selected rows
    const selectedRaw: [ProtocolDataRow | null, ProtocolDataRow | null] = useMemo(
        () => [
            options.find(o => o.key === selections[0])?.row ?? null,
            options.find(o => o.key === selections[1])?.row ?? null,
        ],
        [selections, options]
    )

    const selectedFormatted: [FormattedDataRow | null, FormattedDataRow | null] = useMemo(
        () => [
            selectedRaw[0] ? formatRow(selectedRaw[0]) : null,
            selectedRaw[1] ? formatRow(selectedRaw[1]) : null,
        ],
        [selectedRaw]
    )

    // Handle dropdown changes (with coupling)
    const handleChange = (rowIndex: 0 | 1, newKey: string) => {
        setSelections(prev =>
            computeCoupledSelections(options, [prev[0], prev[1]], rowIndex, newKey)
        )
        const picked = options.find(o => o.key === newKey)?.row
        if (picked && onRowChange) onRowChange(rowIndex, picked)
    }

    // Dropdown cell
    const DropdownCell = ({ rowIndex }: { rowIndex: 0 | 1 }) => {
        const currentKey = selections[rowIndex]
        const current = options.find(o => o.key === currentKey)
        return (
            <div className="flex items-center gap-2">
                {current && (
                    <Image
                        src={`https://storage.googleapis.com/mrgn-public/mrgn-token-icons/${current.token}.png`}
                        alt={current.token}
                        width={20}
                        height={20}
                        className="rounded-full"
                    />
                )}
                <select
                    className="border rounded-md px-2 py-1 bg-transparent"
                    value={currentKey}
                    onChange={e => handleChange(rowIndex, e.target.value)}
                >
                    {options.map(o => (
                        <option key={o.key} value={o.key}>
                            {o.protocol}_{o.token}
                        </option>
                    ))}
                </select>
            </div>
        )
    }

    // Data cells
    const renderDataCells = (row: FormattedDataRow | null) => {
        if (!row) {
            return (
                <TableCell colSpan={11} className="text-muted-foreground">
                    No data
                </TableCell>
            )
        }
        return (
            <>
                <TableCell className="text-green-600">{row.lendingRate}</TableCell>
                <TableCell className="text-yellow-600">{row.borrowingRate}</TableCell>
                <TableCell>{row.liquidity}</TableCell>
                <TableCell>{row.currentUtilization}</TableCell>
                <TableCell>{row.targetUtilization}</TableCell>
                <TableCell>{row.plateauRate}</TableCell>
                <TableCell>{row.maxRate}</TableCell>
                <TableCell>{row.collateralWeight}</TableCell>
                <TableCell>{row.liabilityWeight}</TableCell>
                <TableCell>{row.ltv}</TableCell>
            </>
        )
    }

    // Build two RateSeries for the chart: prefer real curves if present; else constant-line fallbacks
    const chartSeries: [RateSeries, RateSeries] = useMemo(() => {
        return [0, 1].map((idx) => {
            const raw = selectedRaw[idx] as (ProtocolDataRow & {
                curves?: { util: number[]; borrow: number[]; lend: number[] }
            }) | null
            const f = selectedFormatted[idx]
            const key = selections[idx]
            const opt = options.find(o => o.key === key)

            // Try vectors → curves first
            const { borrowCurve, lendCurve } = vectorsToCurves(raw?.curves ?? null)

            return {
                title: opt ? `${opt.protocol}_${opt.token}` : '—',
                color: ROW_COLORS[idx],
                borrowCurve: borrowCurve ?? undefined,
                lendCurve: lendCurve ?? undefined,
                // Fallbacks (if no vectors present)
                borrowRatePct: borrowCurve ? null : parsePercent(f?.borrowingRate),
                lendRatePct: lendCurve ? null : parsePercent(f?.lendingRate),
            } as RateSeries
        }) as [RateSeries, RateSeries]
    }, [options, selections, selectedRaw, selectedFormatted])

    return (
        <div className="space-y-6">
            {/* TABLE */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Protocol_Token</TableHead>
                        <TableHead>Lending<br />Rate</TableHead>
                        <TableHead>Borrow<br />Rate</TableHead>
                        <TableHead>Liquidity</TableHead>
                        <TableHead>Util</TableHead>
                        <TableHead>Target<br />Util</TableHead>
                        <TableHead>Plateau<br />Rate</TableHead>
                        <TableHead>Max<br />Rate</TableHead>
                        <TableHead>Collateral<br />Weight</TableHead>
                        <TableHead>Liability<br />Weight</TableHead>
                        <TableHead>LTV</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {[0, 1].map(idx => (
                        <TableRow key={idx}>
                            <TableCell className="font-medium">
                                <DropdownCell rowIndex={idx as 0 | 1} />
                            </TableCell>
                            {renderDataCells(selectedFormatted[idx])}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* CHART */}
            <RateCharts series={chartSeries} />
        </div>
    )
}
