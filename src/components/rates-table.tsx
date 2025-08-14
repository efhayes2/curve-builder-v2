'use client'

import { ProtocolDataRow } from '@/lib/types'
import { formatRow, FormattedDataRow } from '@/lib/utils'
import { useMemo, useState } from 'react'
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
}

export const RatesTable = ({ data }: Props) => {
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null)
  const [tokenFilter, setTokenFilter] = useState<string | null>(null)

  const filteredData = useMemo(() => {
    return data
        .filter((row) => !protocolFilter || row.protocol === protocolFilter)
        .filter((row) => !tokenFilter || row.token === tokenFilter)
  }, [data, protocolFilter, tokenFilter])

  const formattedData: FormattedDataRow[] = useMemo(() => {
    return filteredData.map(formatRow)
  }, [filteredData])

  const unique = (key: keyof ProtocolDataRow) => [...new Set(data.map(d => d[key]))]
    return (
      <div className="space-y-2">
        <div className="flex gap-4">
          <select onChange={(e) => setProtocolFilter(e.target.value || null)} value={protocolFilter ?? ''}>
            <option value="">All Protocols</option>
            {unique('protocol').map((p) => (
                <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select onChange={(e) => setTokenFilter(e.target.value || null)} value={tokenFilter ?? ''}>
            <option value="">All Tokens</option>
            {unique('token').map((t) => (
                <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocol</TableHead>
              <TableHead>Token</TableHead>
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
            {formattedData.map((row) => (
                <TableRow key={`${row.protocol}-${row.token}`}>
                  <TableCell className="font-medium">{row.protocol}</TableCell>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <Image
                        src={`https://storage.googleapis.com/mrgn-public/mrgn-token-icons/${row.token}.png`}
                        alt={row.token}
                        width={20}
                        height={20}
                        className="rounded-full"
                    />
                    {row.token}
                  </TableCell>
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
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
  )
}
