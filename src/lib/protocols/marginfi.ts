import {makePercentGrid} from '@/lib/utils'
import { Connection, PublicKey } from '@solana/web3.js'
import { aprToApy, Wallet } from '@mrgnlabs/mrgn-common'
import { MarginfiClient, getConfig } from '@mrgnlabs/marginfi-client-v2'
import { ProtocolDataRow } from '@/lib/types'
import type { CurveVectors } from '@/lib/types'
import { optimalUtilizationMap } from '@/lib/utils/shared-data'
import { getMarginLendingAndBorrowingApys } from '../utils/marginfi-functions'
import {TokenData} from "@/data/token-data";

/**
 * Local, synchronous helper to build curve vectors for a Marginfi market.
 * Replace this stub with your real calculator later.
 * - Return percent units for all arrays (e.g., 7.2 for 7.2%)
 * - util must be monotonic in [0..100]
 */
function getMarginfiCurveVectors(optimalUtilization: number,
                                 plateauRate: number,
                                 maxRate: number,
                                 knots: number[],
                                 borrowFee: number): CurveVectors {


    return getMarginLendingAndBorrowingApys(optimalUtilization * 100.0,
        plateauRate * 100.0,
        maxRate * 100.0,
        knots,
        borrowFee)

    // Simple fallback: flat lines at current borrow/lend rates.
    // Swap this for a sampled curve built from bank rate config when ready.
    // return {
    //     knots: [0, 25, 50, 75, 100],
    //     borrowRates: [3.2, 4.1, 5.7, 6.9, 10.3],
    //     lendingRates: [1.1, 2.1, 2.5, 3.6, 5.7],
    // }
}

export async function getMarginfiRates(
    connection: Connection,
    tokenData: Record<string, TokenData>,
    numberOfKnots = 21 // number of points for curves
): Promise<Array<ProtocolDataRow & { curves: CurveVectors }>> {
    const mfiClient = await MarginfiClient.fetch(
        getConfig('production'),
        {} as Wallet,
        connection
    )

    const bankRates = (
        await Promise.all(
            Object.entries(tokenData).map(async ([key, metadata]) => {
                try {
                    const bankPubkey = new PublicKey(key)
                    const bank = mfiClient.getBankByPk(bankPubkey)

                    if (!bank) {
                        console.warn('Marginfi market returned null or undefined.')
                        return null
                    }

                    const factor = 10 ** bank.mintDecimals
                    const rates = bank.computeInterestRates()
                    const lendingBaseRate = rates?.lendingRate.toNumber()
                    const borrowingBaseRate = rates?.borrowingRate.toNumber()
                    const lendingRate_ = aprToApy(lendingBaseRate)
                    const borrowingRate_ = aprToApy(borrowingBaseRate)

                    const assetQty = bank.getTotalAssetQuantity().toNumber() / factor
                    const liabilityQty = bank.getTotalLiabilityQuantity().toNumber() / factor
                    const liquidity_ = assetQty - liabilityQty

                    const assetWeightInit_ = bank.config.assetWeightInit.toNumber()
                    const liabilityWeight_ = bank.config.liabilityWeightInit.toNumber()
                    const ltv_ = 1 / liabilityWeight_
                    const utilization_ = bank.computeUtilizationRate().toNumber()

                    const bankConfig = bank.config
                    const bankRateConfig = bankConfig.interestRateConfig
                    const optimalUtilization_ =
                        bankRateConfig.optimalUtilizationRate.toNumber()
                    const plateauInterestRate_ = bankRateConfig.plateauInterestRate.toNumber()
                    const maxInterestRate_ = bankRateConfig.maxInterestRate.toNumber()

                    // keep optimal map updated
                    optimalUtilizationMap[metadata.tokenSymbol] = optimalUtilization_

                    const rate: ProtocolDataRow = {
                        protocol: 'Marginfi',
                        token: metadata.tokenSymbol,
                        liquidity: liquidity_,
                        currentUtilization: utilization_,
                        targetUtilization: optimalUtilization_,
                        plateauRate: plateauInterestRate_,
                        maxRate: maxInterestRate_,
                        lendingRate: lendingRate_,
                        borrowingRate: borrowingRate_,
                        collateralWeight: assetWeightInit_,
                        liabilityWeight: liabilityWeight_,
                        ltv: ltv_,
                    }

                    if (rate.token == "SOL") {
                        rate.plateauRate = 0.0625;
                        rate.maxRate = 0.45;
                        rate.targetUtilization = 0.92;
                    }

                    // normalize undefined/null → NaN for downstream formatting
                    for (const [k, v] of Object.entries(rate)) {
                        if (v === undefined || v === null) {
                            // @ts-expect-error dynamic assignment for loose SDK types
                            rate[k] = NaN
                        }
                    }

                    const borrowFee  = bank.config.interestRateConfig.protocolIrFee.toNumber() / 100.0
                    const knots = makePercentGrid(numberOfKnots) // 0..100 in 1% steps
                    // Attach curve vectors (stubbed for now)
                    const curves = getMarginfiCurveVectors(optimalUtilization_,
                        plateauInterestRate_, maxInterestRate_, knots, borrowFee)

                    // Clamp/sanitize just in case future impl returns mismatched lengths
                    const n = Math.min(curves.knots.length, curves.borrowRates.length, curves.lendingRates.length)
                    const sanitized: CurveVectors = {
                        knots: curves.knots.slice(0, n).map((u) => Math.max(0, Math.min(100, u))),
                        borrowRates: curves.borrowRates.slice(0, n),
                        lendingRates: curves.lendingRates.slice(0, n),
                    }

                    return { ...rate, curves: sanitized }
                } catch (err) {
                    console.warn(`Skipping ${metadata.tokenSymbol}:`, err)
                    return null
                }
            })
        )
    ).filter(
        (r): r is ProtocolDataRow & { curves: CurveVectors } => r !== null
    )

    return bankRates
}
