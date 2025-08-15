/**
 * @file src/lib/utils.test.ts
 * Jest tests for computeCoupledSelections
 */

import { computeCoupledSelections } from './utils'

// Minimal shape to satisfy the helper.
// If you have real ProtocolDataRow, import it and replace `any`.
type ProtocolDataRow = any

type MarketOption = {
    key: string
    protocol: string
    token: string
    row: ProtocolDataRow
}

const mk = (protocol: string, token: string): MarketOption => ({
    key: `${protocol}_${token}`,
    protocol,
    token,
    row: { protocol, token } as ProtocolDataRow,
})

describe('computeCoupledSelections', () => {
    test('1a) marginfi_X → prefers kamino_X when it exists', () => {
        const options = [mk('marginfi', 'SOL'), mk('kamino', 'SOL')]
        const prev: [string, string] = [options[0].key, options[1].key] // initial values don't matter
        const out = computeCoupledSelections(options, prev, 0, mk('marginfi', 'SOL').key)
        expect(out[1]).toBe('kamino_SOL')
    })

    test('1b) marginfi_X → falls back to drift_X if no kamino_X', () => {
        const options = [mk('marginfi', 'USDC'), mk('drift', 'USDC')]
        const prev: [string, string] = ['marginfi_USDC', 'marginfi_USDC']
        const out = computeCoupledSelections(options, prev, 1, 'marginfi_USDC')
        expect(out[0]).toBe('drift_USDC') // other row updated
    })

    test('1c) marginfi_X → falls back to save_X if no kamino_X and no drift_X', () => {
        const options = [mk('marginfi', 'BTC'), mk('save', 'BTC')]
        const prev: [string, string] = ['save_BTC', 'save_BTC']
        const out = computeCoupledSelections(options, prev, 0, 'marginfi_BTC')
        expect(out[1]).toBe('save_BTC')
    })

    test('1d) marginfi_X → falls back to anyProtocol_X if no kamino/drift/save', () => {
        const options = [mk('marginfi', 'ETH'), mk('otherdex', 'ETH')]
        const prev: [string, string] = ['otherdex_ETH', 'otherdex_ETH']
        const out = computeCoupledSelections(options, prev, 1, 'marginfi_ETH')
        expect(out[0]).toBe('otherdex_ETH')
    })

    test("1e) marginfi_X → leaves other row unchanged if no counterpart for token 'X' exists", () => {
        const options = [mk('marginfi', 'BONK')] // no other protocol with BONK
        const prev: [string, string] = ['marginfi_BONK', 'marginfi_BONK']
        const out = computeCoupledSelections(options, prev, 0, 'marginfi_BONK')
        expect(out[1]).toBe(prev[1]) // unchanged
    })

    test('2a) non-marginfi_X → switches other row to marginfi_X when it exists', () => {
        const options = [mk('kamino', 'SOL'), mk('marginfi', 'SOL')]
        const prev: [string, string] = ['kamino_SOL', 'kamino_SOL']
        const out = computeCoupledSelections(options, prev, 1, 'kamino_SOL')
        expect(out[0]).toBe('marginfi_SOL')
    })

    test('2b) non-marginfi_X → leaves other row unchanged if no marginfi_X exists', () => {
        const options = [mk('kamino', 'USDT'), mk('drift', 'USDT')]
        const prev: [string, string] = ['kamino_USDT', 'drift_USDT']
        const out = computeCoupledSelections(options, prev, 0, 'kamino_USDT')
        expect(out[1]).toBe(prev[1]) // unchanged
    })

    test('Respects changedIndex — only the other row is auto-adjusted', () => {
        const options = [mk('marginfi', 'SOL'), mk('kamino', 'SOL')]
        // Start with both set to marginfi_SOL
        const prev: [string, string] = ['marginfi_SOL', 'marginfi_SOL']

        // Change row 0 to marginfi_SOL (rule triggers, other is row 1)
        const out0 = computeCoupledSelections(options, prev, 0, 'marginfi_SOL')
        expect(out0[0]).toBe('marginfi_SOL')
        expect(out0[1]).toBe('kamino_SOL')

        // Change row 1 to marginfi_SOL (rule triggers, other is row 0)
        const out1 = computeCoupledSelections(options, prev, 1, 'marginfi_SOL')
        expect(out1[1]).toBe('marginfi_SOL')
        expect(out1[0]).toBe('kamino_SOL')
    })

    test('Gracefully ignores invalid selections', () => {
        const options = [mk('marginfi', 'SOL'), mk('kamino', 'SOL')]
        const prev: [string, string] = ['marginfi_SOL', 'kamino_SOL']
        const out = computeCoupledSelections(options, prev, 0, 'nonexistent_key')
        expect(out).toEqual(prev) // no change
    })
})
