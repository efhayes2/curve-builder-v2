
import {SLOTS_PER_YEAR, ONE_HUNDRED_PCT_IN_BPS} from "@/lib/utils/kamino-constants";
import Decimal from "decimal.js";


export interface CurvePointFields {
    utilizationRateBps: number
    borrowRateBps: number
}

const truncateBorrowCurve = (points: CurvePointFields[]): [number, number][] => {
    const curve: [number, number][] = [];
    for (const { utilizationRateBps, borrowRateBps } of points) {
        curve.push([utilizationRateBps / ONE_HUNDRED_PCT_IN_BPS, borrowRateBps / ONE_HUNDRED_PCT_IN_BPS]);

        if (utilizationRateBps === ONE_HUNDRED_PCT_IN_BPS) {
            break;
        }
    }
    return curve;
};

export const interpolate = (x: number, x0: number, x1: number, y0: number, y1: number) => {
    if (x > x1) {
        throw 'Cannot do extrapolation';
    }

    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
};

export const getInterpolatedRate =
    (currentUtilization: number, curve: [number, number][]): number => {
    let [x0, y0, x1, y1] = [0, 0, 0, 0];

    if (curve.length < 2) {
        throw 'Invalid borrow rate curve, only one point';
    }

    if (currentUtilization > 1) {
        currentUtilization = 1;
    }

    for (let i = 1; i < curve.length; i++) {
        const [pointUtilization, pointRate] = curve[i];
        if (pointUtilization === currentUtilization) {
            return pointRate;
        }

        if (currentUtilization <= pointUtilization) {
            x0 = curve[i - 1][0];
            y0 = curve[i - 1][1];
            x1 = curve[i][0];
            y1 = curve[i][1];
            break;
        }
    }

    if (x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) {
        console.log('All are 0');
        throw 'Invalid borrow rate curve, could not identify the interpolation points.';
    }

    if (x0 >= x1 || y0 > y1) {
        console.log('(x0, y0), (x1, y1)', x0, y0, x1, y1);
        throw 'Invalid borrow rate curve, curve is not uniformly increasing';
    }

    return interpolate(currentUtilization, x0, x1, y0, y1);
};


export function calculateAPYFromAPR(apr: number) {
    const apy = new Decimal(1).plus(new Decimal(apr).dividedBy(SLOTS_PER_YEAR)).toNumber() ** SLOTS_PER_YEAR - 1;
    return apy;
}

export function getLendingAndBorrowingApys(krData: any, utilization: number) {

    const { fixedHostInterestRate, slotAdjustmentFactor, protocolTakeRatePct,
        borrowRateCurvePoints} = krData;

    const curve = truncateBorrowCurve(borrowRateCurvePoints);
    const estimatedBorrowRate = getInterpolatedRate(utilization, curve);;
    const borrowApr = (estimatedBorrowRate + fixedHostInterestRate) * slotAdjustmentFactor;

    const protocolTakeRatePct_ = 1 - protocolTakeRatePct / 100;
    const supplyApr = utilization * estimatedBorrowRate * slotAdjustmentFactor * protocolTakeRatePct_;

    const borrowApy = calculateAPYFromAPR(borrowApr);
    const lendingApy = calculateAPYFromAPR(supplyApr);

    return { lendingApy, borrowApy };
}

// export function calculateBorrowAPR(krData: any, utilization: number) {
//     const { fixedHostInterestRate, slotAdjustmentFactor } = krData;
//     const borrowRate = calculateEstimatedBorrowRate(krData, utilization );
//     return borrowRate + fixedHostInterestRate * slotAdjustmentFactor;
// }

// export function calculateSupplyAPR(krData: any, utilization: number) {
//
//     const { protocolTakeRatePct } = krData;
//     const estimatedBorrowRate = calculateEstimatedBorrowRate(krData, utilization);
//     const protocolTakeRatePct_ = 1 - protocolTakeRatePct / 100;
//     const supplyApr = utilization * estimatedBorrowRate * protocolTakeRatePct_;
//     return supplyApr;
//
// }

// export function old_getLendingAndBorrowingApys(krData: any, utilization: number) {
//
//     const borrowApr = calculateBorrowAPR(krData, utilization);
//     const supplyApr = calculateSupplyAPR(krData, utilization);
//
//     const borrowApy = calculateAPYFromAPR(borrowApr);
//     const lendingApy = calculateAPYFromAPR(supplyApr);
//
//     return { lendingApy, borrowApy };
//
// }

// export function calculateEstimatedBorrowRate(utilization: number, slotAdjustmentFactor: number,
//                                              curve2: [number, number][]) {
//
//     // This function properly estimates the borrow rate based on the current utilization and taking into account
//     // the impact of the new borrow. We are skipping over that for now.
//     // Const estimatedCurrentUtilization = reserve.getEstimatedUtilizationRatio(slot, referralFeeBps);
//
//     // const { borrowRateCurvePoints, slotAdjustmentFactor } = krData;
//
//     const interpolatedBorrowRate = getInterpolatedRate(utilization, curve2);
//     return interpolatedBorrowRate * slotAdjustmentFactor;
// }
