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
    data: ProtocolDataRow[]
    /** Optional: fire when a row selection changes so graphs or parent state can update */
    onRowChange?: (rowIndex: number, selection: ProtocolDataRow) => void
}

const makeKey = (r: { protocol: string; token: string }) => `${r.protocol}_${r.token}`

/** Accepts "12.3%", "12.3 %", or a decimal number like 0.123 → returns percentage number 12.3 */
const parsePercent = (val?: string | number | null): number | null => {
    if (val == null) return null
    if (typeof val === 'number') return val * 100
    const m = String(val).match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
}

// Row colors: Line 1 and Line 2 (lend = dashed same color)
const ROW_COLORS: [string, string] = ['#2563eb', '#f97316'] // blue, orange

/** Pick the default first selection: marginfi_<alphabetically first token>, else fallback to the first option. */
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

export const RatesTable = ({ data, onRowChange }: Props) => {
    // Build unique (protocol, token) options from incoming data
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

    // Compute the "default" two selections:
    // - Row 0: marginfi_<first token alphabetically> (or first available option if no marginfi)
    // - Row 1: auto-derived via computeCoupledSelections from Row 0
    const defaultSelections: [string, string] = useMemo(() => {
        if (options.length === 0) return ['', '']
        const firstKey = pickDefaultFirstKey(options)
        return computeCoupledSelections(options, ['', ''], 0, firstKey)
    }, [options])

    // Two selections (one per table row), initialized from our default rule
    const [selections, setSelections] = useState<[string, string]>(defaultSelections)

    // Keep selections valid / reset to defaults when data/options change or selections are empty/invalid
    useEffect(() => {
        setSelections(prev => {
            const keySet = new Set(options.map(o => o.key))
            const missing0 = prev[0] && !keySet.has(prev[0])
            const missing1 = prev[1] && !keySet.has(prev[1])
            const bothEmpty = !prev[0] && !prev[1]
            return (bothEmpty || missing0 || missing1) ? defaultSelections : prev
        })
    }, [defaultSelections, options])

    // Look up the selected raw + formatted rows
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

    // Handle a change to either row's Protocol_Token,
    // and apply coupling rules for the "other" row.
    const handleChange = (rowIndex: 0 | 1, newKey: string) => {
        setSelections(prev =>
            computeCoupledSelections(options, [prev[0], prev[1]], rowIndex, newKey)
        )

        // Notify parent about the changed row (optional)
        const picked = options.find(o => o.key === newKey)?.row
        if (picked && onRowChange) onRowChange(rowIndex, picked)
    }

    // Dropdown UI in the first column
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

    // Render the rest of the data cells for a given formatted row
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

    // Prepare two series for the charts component (constant-line fallback for now)
    const chartSeries: [RateSeries, RateSeries] = [0, 1].map(idx => {
        const f = selectedFormatted[idx]
        const key = selections[idx]
        const opt = options.find(o => o.key === key)

        return {
            title: opt ? `${opt.protocol}_${opt.token}` : '—',
            color: ROW_COLORS[idx],
            borrowRatePct: parsePercent(f?.borrowingRate),
            lendRatePct: parsePercent(f?.lendingRate),
            // Later you can pass full curves instead:
            // borrowCurve: curves.borrow[idx] ?? null,
            // lendCurve: curves.lend[idx] ?? null,
        } as RateSeries
    }) as [RateSeries, RateSeries]

    return (
        <div className="space-y-6">
            {/* TABLE */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Protocol_Token</TableHead>
                        <TableHead>
                            Lending
                            <br />
                            Rate
                        </TableHead>
                        <TableHead>
                            Borrow
                            <br />
                            Rate
                        </TableHead>
                        <TableHead>Liquidity</TableHead>
                        <TableHead>Util</TableHead>
                        <TableHead>
                            Target
                            <br />
                            Util
                        </TableHead>
                        <TableHead>
                            Plateau
                            <br />
                            Rate
                        </TableHead>
                        <TableHead>
                            Max
                            <br />
                            Rate
                        </TableHead>
                        <TableHead>
                            Collateral
                            <br />
                            Weight
                        </TableHead>
                        <TableHead>
                            Liability
                            <br />
                            Weight
                        </TableHead>
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
