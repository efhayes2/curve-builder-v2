// src/lib/protocols/marginfi-functions.ts
export type CurveArrays = {
    knots: number[];
    borrowRates: number[];   // percent units, e.g. 7.2
    lendingRates: number[];  // percent units, e.g. 5.1
};

/**
 * Build and sanitize Marginfi curve arrays.
 * * Expects "percent units" for utilization and rates (0..100), and borrowFee as a percent.
 * * Clamps knots to [0, 100] and aligns array lengths.
 *
 * If your underlying generator returns fractional rates (0..1),
 * pass { ratesAreFractions: true } to convert to percent units.
 */
export function buildMarginfiCurves(params: {
    optimalUtilizationPct: number;   // 0..100
    plateauRatePct: number;          // percent, e.g. 7.2
    maxRatePct: number;              // percent, e.g. 25.0
    numberOfKnots: number;           // e.g. 101
    borrowFeePct: number;            // percent (NOT fraction)
    ratesAreFractions?: boolean;     // default false
    makePercentGrid: (count: number) => number[];
    getMarginfiCurveVectors: (
        optimalUtilizationPct: number,
        plateauRatePct: number,
        maxRatePct: number,
        knotsPct: number[],
        borrowFeeFraction: number
    ) => { knots: number[]; borrowRates: number[]; lendingRates: number[] };
}): CurveArrays {
    const {
        optimalUtilizationPct,
        plateauRatePct,
        maxRatePct,
        numberOfKnots,
        borrowFeePct,
        ratesAreFractions = false,
        makePercentGrid,
        getMarginfiCurveVectors,
    } = params;

    // Build 0..100 utilization grid (percent units)
    const knots = makePercentGrid(numberOfKnots);

    // Borrow fee to fraction for the generator (e.g. 10% -> 0.10)
    const borrowFeeFraction = borrowFeePct / 100;

    // Generate raw vectors (assumed percent units for rates unless flagged)
    const curves = getMarginfiCurveVectors(
        optimalUtilizationPct,
        plateauRatePct,
        maxRatePct,
        knots,
        borrowFeeFraction
    );

    // Align lengths and clamp knots
    const n = Math.min(
        curves.knots.length,
        curves.borrowRates.length,
        curves.lendingRates.length
    );

    let alignedKnots = curves.knots.slice(0, n).map(u => Math.max(0, Math.min(100, u)));
    let borrow = curves.borrowRates.slice(0, n);
    let lend  = curves.lendingRates.slice(0, n);

    // Ensure percent units if the generator produced fractions
    if (ratesAreFractions) {
        borrow = borrow.map(x => x * 100);
        lend   = lend.map(x => x * 100);
    }

    return { knots: alignedKnots, borrowRates: borrow, lendingRates: lend };
}
