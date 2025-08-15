'use client'

import { ProtocolDataRow } from '@/lib/types'
import {computeCoupledSelections, formatRow, FormattedDataRow} from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Props = {
  data: ProtocolDataRow[]
  /** Optional: fire when a row selection changes so graphs can update */
  onRowChange?: (rowIndex: number, selection: ProtocolDataRow) => void
}

const makeKey = (r: { protocol: string; token: string }) => `${r.protocol}_${r.token}`

export const RatesTable = ({ data, onRowChange }: Props) => {
  // Build stable option set: one per (protocol, token)
  const options = useMemo(() => {
    const seen = new Set<string>()
    const list = [] as { key: string; protocol: string; token: string; row: ProtocolDataRow }[]
    for (const r of data) {
      const key = makeKey(r)
      if (!seen.has(key)) {
        seen.add(key)
        list.push({ key, protocol: r.protocol, token: r.token, row: r })
      }
    }
    return list
  }, [data])

  // Initial selections: first two options (or duplicate first if only one exists)
  const [selections, setSelections] = useState<string[]>([
    options[0]?.key ?? '',
    options[1]?.key ?? options[0]?.key ?? '',
  ])

  // Keep selections in sync if data/options change
  useEffect(() => {
    setSelections((prev) => {
      const next = [...prev]
      if (!options.find(o => o.key === next[0])) next[0] = options[0]?.key ?? ''
      if (!options.find(o => o.key === next[1])) next[1] = options[1]?.key ?? options[0]?.key ?? ''
      return next
    })
  }, [options])

  // Lookup selected raw + formatted rows for each table row
  const selectedRaw: (ProtocolDataRow | null)[] = useMemo(() => {
    return selections.map(k => options.find(o => o.key === k)?.row ?? null)
  }, [selections, options])

  const selectedFormatted: (FormattedDataRow | null)[] = useMemo(() => {
    return selectedRaw.map(r => (r ? formatRow(r) : null))
  }, [selectedRaw])

  const handleChange = (rowIndex: 0 | 1, newKey: string) => {
    setSelections(prev => {
      const updated = computeCoupledSelections(options, [prev[0], prev[1]] as [string, string], rowIndex, newKey);
      return updated;
    });

    const picked = options.find(o => o.key === newKey)?.row;
    if (picked && onRowChange) onRowChange(rowIndex, picked);
  };


  // Render a dropdown cell with token icon + text
  const DropdownCell = ({ rowIndex }: { rowIndex: number }) => {
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
              onChange={(e) => handleChange(rowIndex, e.target.value)}
          >
            {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.protocol}_{o.token}
                </option>
            ))}
          </select>
        </div>
    )
  }

  const renderDataCells = (row: FormattedDataRow | null) => {
    if (!row) {
      return (
          <>
            <TableCell colSpan={11} className="text-muted-foreground">No data</TableCell>
          </>
      )
    }
    return (
        <>
          {/* Lending / Borrow */}
          <TableCell className="text-green-600">{row.lendingRate}</TableCell>
          <TableCell className="text-yellow-600">{row.borrowingRate}</TableCell>

          {/* Liquidity / Utilization */}
          <TableCell>{row.liquidity}</TableCell>
          <TableCell>{row.currentUtilization}</TableCell>
          <TableCell>{row.targetUtilization}</TableCell>

          {/* Rate Curve */}
          <TableCell>{row.plateauRate}</TableCell>
          <TableCell>{row.maxRate}</TableCell>

          {/* Risk */}
          <TableCell>{row.collateralWeight}</TableCell>
          <TableCell>{row.liabilityWeight}</TableCell>
          <TableCell>{row.ltv}</TableCell>
        </>
    )
  }

  return (
      <div className="space-y-2">
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
            {[0, 1].map((idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    <DropdownCell rowIndex={idx} />
                  </TableCell>
                  {renderDataCells(selectedFormatted[idx])}
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  )
}
