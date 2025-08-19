
import type { CurveVectors } from '@/lib/types'

/**
 * Build borrow/lend APY curves for Marginfi across a set of utilization "knots".
 *
 * Assumptions / units:
 * - `knots` are utilization PERCENT points in [0, 100] (e.g., [0,25,50,75,100]).
 * - `optimalUtilization` is a PERCENT in [0, 100].
 * - `plateauRate` and `maxRate` are **APR decimals** (e.g., 0.12 for 12% APR).
 * - `borrowFee` is a **decimal multiplier component** (e.g., 0.1 -> +10% fee).
 * - Output APYs are returned in **percent units** (e.g., 7.2 = 7.2% APY),
 *   matching the expectations of your chart code.
 *
 * Formulae per point (util%):
 *   if util < optimal:
 *     borrowAPR = (util / optimal) * plateauRate
 *   else:
 *     borrowAPR = plateauRate + ((util - optimal) / (100 - optimal)) * (maxRate - plateauRate)
 *
 *   borrowAPR *= (1 + borrowFee)
 *   lendAPR = borrowAPR * (util / 100)
 *
 *   APY = (1 + APR / N) ^ N - 1, with N = 525_600 (minutes per year)
 */
export function getMarginLendingAndBorrowingApys(
    optimalUtilization: number,
    plateauRate: number,
    maxRate: number,
    knots: number[],
    borrowFee: number
): CurveVectors {
    // --- constants ---
    const N = 525_600; // compounds/year ~ every minute
    const optPct = clamp(optimalUtilization, 0, 100);

    const util = knots;
    const borrowRates: number[] = new Array(util.length);
    const lendingRates: number[] = new Array(util.length);

    const denomRight = Math.max(1e-9, 100 - optPct); // avoid divide-by-zero

    for (let i = 0; i < util.length; i++) {
        const uPct = util[i];
        const u01 = uPct / 100;

        // piecewise APR (decimal)
        let borrowApr: number;
        if (uPct < optPct && optPct > 0) {
            borrowApr = (uPct / optPct) * plateauRate;
        } else if (uPct < optPct && optPct === 0) {
            // degenerate case: optimal=0 → treat left side as plateau at 0
            borrowApr = 0;
        } else {
            borrowApr =
                plateauRate + ((uPct - optPct) / denomRight) * (maxRate - plateauRate);
        }



        // lender side APR proportional to utilization
        const lendApr = borrowApr * u01;

        // fee markup
        borrowApr *= (1 + borrowFee);


        // APR → APY via high-frequency compounding (approx. continuous)
        const borrowApy = Math.pow(1 + borrowApr / 100.0 / N, N) - 1;
        const lendApy = Math.pow(1 + lendApr / 100.0 / N, N) - 1;

        // return % units for charting (e.g., 7.2)
        borrowRates[i] = borrowApy * 100.0;
        lendingRates[i] = lendApy * 100.0;
    }



    return { knots:knots, borrowRates: borrowRates, lendingRates: lendingRates };
}

/* ---------------------------- helpers ---------------------------- */

function clamp(x: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : lo));
}
