// src/lib/protocols/kamino.ts

import { getLendingAndBorrowingApys } from '@/lib/utils/kamino-functions'
import { optimalUtilizationMap, mfiDefaultOptimal } from '@/lib/utils/shared-data';
import { ProtocolDataRow, CurveVectors } from '@/lib/types'
import {makePercentGrid} from '@/lib/utils' // where your TokenData lives
import { transformBorrowCurve } from '@/lib/utils/borrow-curve'

import { KaminoMarket } from '@kamino-finance/klend-sdk'
import { PublicKey, Connection } from '@solana/web3.js'
import {TokenData} from "@/data/token-data";


// Collect per-token curves already transformed to {knots, values}
// const borrowCurveLog: Record<string, { knots: number[]; values: number[] }> = {}





// Synchronous curve builder that samples your existing APY function
// at the given x-axis vector (utilization in PERCENT units).
// Returns three aligned vectors suitable for charting.

function getKaminoCurveVectors(krData: any, utilPercents: number[]): CurveVectors {

    // Sample APYs at each utilization; convert % → fraction for the evaluator
    const borrow: number[] = new Array(utilPercents.length)
    const lend: number[] = new Array(utilPercents.length)

    for (let i = 0; i < utilPercents.length; i++) {
        const u01 = utilPercents[i] / 100
        const { lendingApy, borrowApy } = getLendingAndBorrowingApys(krData, u01)
        borrow[i] = borrowApy * 100.0 // % units (e.g., 7.2)
        lend[i] = lendingApy * 100.0 // % units
    }

    return { knots: utilPercents, borrowRates: borrow, lendingRates: lend }
}


export async function getKaminoRates(
    connection: Connection,
    tokenData: Record<string, TokenData>,
    n = 101 // number of points for curves
): Promise<Array<ProtocolDataRow & { curves: CurveVectors }>> {
    try {
        const kaminoMarket = await KaminoMarket.load(
            connection,
            new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF'),
            400
        )

        if (!kaminoMarket) {
            console.warn('KaminoMarket returned null or undefined.')
            return []
        }

        await kaminoMarket.loadReserves()
        const currentSlot = await connection.getSlot()

        // used by your existing logging at the end
        const borrowCurveLog: Record<string, unknown> = {}

        // Build rows (with curves) concurrently
        const ratePromises = Object.entries(tokenData).map(async ([, metadata]) => {
            try {
                const mint = new PublicKey(metadata.tokenAddress)

                const k = kaminoMarket.getReserveByMint(mint)
                if (!k) {
                    console.warn('KaminoMarket returned null or undefined.')
                    return []
                }

                // ---- Safe conversions (avoid BN > 53-bit toNumber) ----
                const mintFactor = Number(k.getMintFactor().toString())
                if (!mintFactor || mintFactor === 0) throw new Error('Invalid mint factor')

                const borrowed = Number(k.getBorrowedAmount().toString()) / mintFactor
                const total = Number(k.getTotalSupply().toString()) / mintFactor
                const liquidity_ = total - borrowed
                const utilization = k.calculateUtilizationRatio()

                const stats = k.stats
                const assetWeight = stats.loanToValue
                const liabilityWeight_ = stats.borrowFactor / 100.0
                const ltv_ = 1.0 / liabilityWeight_

                // ---- Borrow curve logging (transform at assignment) ----
                const borrowCurve = stats.borrowCurve // [number, number][]
                const borrowRateCurvePoints = k.state.config.borrowRateCurve.points
                borrowCurveLog[metadata.tokenSymbol] = transformBorrowCurve(borrowCurve)

                const protocolTakeRatePct = k.state.config.protocolTakeRatePct
                const slotAdjustmentFactor = k.slotAdjustmentFactor()
                const fixedHostInterestRate = k.getFixedHostInterestRate().toNumber()

                const wrappedReserveData = {
                    protocolTakeRatePct,
                    borrowRateCurvePoints,
                    slotAdjustmentFactor,
                    fixedHostInterestRate,
                }

                // Max and "plateau" (at marginfi optimal) borrow APYs (your existing logic)
                const { borrowApy: maxBorrowApy } =
                    getLendingAndBorrowingApys(wrappedReserveData, 1.0)

                const marginfiOptimal =
                    optimalUtilizationMap[metadata.tokenSymbol] ?? mfiDefaultOptimal

                const { borrowApy: borrowApyAtMarginfiOptimal } =
                    getLendingAndBorrowingApys(wrappedReserveData, marginfiOptimal)

                // Point-in-time APYs (current slot)
                const lendingRate_ = k.totalSupplyAPY(currentSlot)
                const borrowingRate_ = k.totalBorrowAPY(currentSlot)

                // ---- Protocol row (as before) ----
                const rate: ProtocolDataRow = {
                    protocol: 'Kamino',
                    token: metadata.tokenSymbol,
                    liquidity: liquidity_,
                    currentUtilization: utilization,
                    optimalUtilization: marginfiOptimal,
                    plateauRate: borrowApyAtMarginfiOptimal,
                    maxRate: maxBorrowApy,
                    lendingRate: lendingRate_,
                    borrowingRate: borrowingRate_,
                    collateralWeight: assetWeight,
                    liabilityWeight: liabilityWeight_,
                    ltv: ltv_,
                }

                // Normalize undefined/nulls to NaN for downstream formatting
                for (const [key, value] of Object.entries(rate)) {
                    if (value === undefined || value === null) {
                        // @ts-expect-error dynamic assignment
                        rate[key] = NaN
                    }
                }

                const utilPercents = makePercentGrid(n) // 0..100 in 1% steps
                const curves: CurveVectors = getKaminoCurveVectors(wrappedReserveData, utilPercents);

                return { ...rate, curves: curves }
            } catch (err) {
                console.warn(`Skipping ${metadata.tokenSymbol}:`, err)
                return null
            }
        })

        const results = await Promise.all(ratePromises)
        const rates = results.filter((r): r is ProtocolDataRow & { curves: CurveVectors } => r !== null)

        // Write once per run (timestamped file)
        // Only write locally (skip in Vercel or production)
        // if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
        //     await writeBorrowCurveLog(borrowCurveLog)
        // }

        return rates
    } catch (err) {
        console.error('Failed to get Kamino rates:', err)
        return []
    }
}
