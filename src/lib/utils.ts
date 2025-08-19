import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CurveVectors, CurvePoint } from '@/lib/types'

export type Environment = "production" | "staging";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return `n` equally spaced percent points from 0 to 100 (inclusive).
 * Ensures at least 2 points, clamps/normalizes input, and avoids
 * floating-point tails (e.g., 99.999999) by rounding to 6 decimals.
 *
 * Examples:
 *   makePercentGrid(5)   -> [0, 25, 50, 75, 100]
 *   makePercentGrid(101) -> [0, 1, 2, ..., 100]
 */
export function makePercentGrid(n: number): number[] {
    const count = Math.max(2, Math.floor(Number.isFinite(n) ? n : 0))
    const step = 100 / (count - 1)
    const out = new Array<number>(count)
    for (let i = 0; i < count; i++) {
        // round to tame FP error while keeping monotonicity
        out[i] = Number((i * step).toFixed(6))
    }
    return out
}


// Add these helpers to keep the component lean and testable.

import type { ProtocolDataRow } from '@/lib/types'

export type MarketOption = {
    key: string
    protocol: string
    token: string
    row: ProtocolDataRow
}

/** Accepts "12.3%", "12.3 %", or a decimal number like 0.123 → returns percentage number 12.3 */
export const parsePercent = (val?: string | number | null): number | null => {
    if (val == null) return null
    if (typeof val === 'number') return val * 100
    const m = String(val).match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
}

// Shape that matches what the chart needs, without importing the component type.
export type RateSeriesData = {
    title: string
    color: string
    borrowRatePct: number | null
    lendRatePct: number | null
    // (optional future fields)
    borrowCurve?: Array<{ util: number; rate: number }> | null
    lendCurve?: Array<{ util: number; rate: number }> | null
}

/**
 * Build the two chart series from current selections and formatted rows.
 * Pure: no React hooks, no component state.
 */
export function buildRateSeriesData(
    options: MarketOption[],
    selections: [string, string],
    formatted: [/* FormattedDataRow */ any | null, any | null],
    colors: [string, string]
): [RateSeriesData, RateSeriesData] {
    return [0, 1].map((idx) => {
        const f = formatted[idx]
        const key = selections[idx]
        const opt = options.find((o) => o.key === key)
        return {
            title: opt ? `${opt.protocol}_${opt.token}` : '—',
            color: colors[idx],
            borrowRatePct: parsePercent(f?.borrowingRate),
            lendRatePct: parsePercent(f?.lendingRate),
        }
    }) as [RateSeriesData, RateSeriesData]
}


/**
 * Apply coupling rules when one row's Protocol_Token selection changes.
 *
 * Rules:
 * 1) If protocol == marginfi:
 *    a) if kamino_token exists, change the other row to that
 *    b) elif drift_token exists, change the other row to that
 *    c) elif save_token exists, change the other row to that
 *    d) elif anyProtocol_token exists, change the other row to that
 *    e) else, don't change the other row
 * 2) If protocol != marginfi:
 *    a) change the other row to marginfi_token if it exists
 *    b) else, don't change the other row
 */
export function computeCoupledSelections(
    options: MarketOption[],
    currentSelections: [string, string], // [row0Key, row1Key]
    changedIndex: 0 | 1,
    newKey: string
): [string, string] {
    const otherIndex = changedIndex === 0 ? 1 : 0;
    const next: [string, string] = [...currentSelections] as [string, string];
    next[changedIndex] = newKey;

    const picked = options.find(o => o.key === newKey);
    if (!picked) return next; // invalid selection; do nothing safely

    const token = picked.token;
    const proto = picked.protocol.toLowerCase();

    const findKey = (protocol?: string, tokenFilter?: string) =>
        options.find(o =>
            (protocol ? o.protocol.toLowerCase() === protocol.toLowerCase() : true) &&
            (tokenFilter ? o.token === tokenFilter : true)
        )?.key ?? null;

    if (proto === 'marginfi') {
        // 1a → 1b → 1c → 1d
        const desired =
            findKey('kamino', token) ??
            findKey('drift', token) ??
            findKey('save', token) ??
            findKey(undefined, token); // any protocol with same token

        if (desired) next[otherIndex] = desired;
        // 1e: else leave the other row unchanged
    } else {
        // 2a → 2b
        const desired = findKey('marginfi', token);
        if (desired) next[otherIndex] = desired;
        // else leave unchanged
    }

    return next;
}


export type FormattedDataRow = { [K in keyof ProtocolDataRow]: string };

export function formatRow(row: ProtocolDataRow): FormattedDataRow {
    const safeNumber = (val: number | string) =>
        isNaN(Number(val)) ? "-" : Number(val);

    const formatPercent = (val: number | string, decimals = 1) =>
        isNaN(Number(val)) ? "-" : `${(Number(val) * 100).toFixed(decimals)}%`;

    const formatFixed = (val: number | string, decimals = 2) =>
        isNaN(Number(val)) ? "-" : Number(val).toFixed(decimals);


    const formatCompactNumber = (val: number | string): string => {
        const num = safeNumber(val);
        if (num === "-") return "-";

        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`;
        if (num >= 100_000) return `${Math.round(num / 1_000)}k`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
        return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    return {
        protocol: row.protocol,
        token: row.token,
        liquidity: formatCompactNumber(row.liquidity),
        currentUtilization: formatPercent(row.currentUtilization),
        targetUtilization: formatPercent(row.targetUtilization),
        plateauRate: formatPercent(row.plateauRate, 2),
        maxRate: formatPercent(row.maxRate, 0),
        lendingRate: formatPercent(row.lendingRate, 2),
        borrowingRate: formatPercent(row.borrowingRate, 2),
        collateralWeight: formatPercent(row.collateralWeight, 0),
        liabilityWeight: formatFixed(row.liabilityWeight, 2),
        ltv: formatPercent(row.ltv, 0),
    };
}


export type TokenData = {
    category: string;
    tokenAddress: string;
    tokenSymbol: string;
};


export function getTokenDataMap(): Record<string, TokenData> {
    const useFullTable = false;
    if (useFullTable)
        return getTokenDataMapFull();
    return getTokenDataMapPartial();

}

export function getTokenDataMapFull(): Record<string, TokenData> {

    return {
        "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh": {
            category: "LST",
            tokenAddress: "So11111111111111111111111111111111111111112",
            tokenSymbol: "SOL",
        },
        "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB": {
            category: "Stable",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenSymbol: "USDC",
        },
        "Dj2CwMF3GM7mMT5hcyGXKuYSQ2kQ5zaVCkA1zX1qaTva": {
            category: "Stable",
            tokenAddress: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
            tokenSymbol: "USDG",
        },
        "FDsf8sj6SoV313qrA91yms3u5b3P4hBxEPvanVs8LtJV": {
            category: "Stable",
            tokenAddress: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
            tokenSymbol: "USDS",
        },
        "8UEiPmgZHXXEDrqLS3oiTxQxTbeYTtPbeMBxAd2XGbpu": {
            category: "Stable",
            tokenAddress: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
            tokenSymbol: "PYUSD",
        },
        "GJCi1uj3kYPZ64puA5sLUiCQfFapxT2xnREzrbDzFkYY": {
            category: "LST",
            tokenAddress: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
            tokenSymbol: "hSOL",
        },
        "8LaUZadNqtzuCG7iCvZd7d5cbquuYfv19KjAg6GPuuCb": {
            category: "LST",
            tokenAddress: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
            tokenSymbol: "jupSOL",
        },
        "BeNBJrAh1tZg5sqgt8D6AWKJLD5KkBrfZvtcgd7EuiAR": {
            category: "Stable",
            tokenAddress: "7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT",
            tokenSymbol: "UXD",
        },
        "HmpMfL8942u22htC4EMiWgLX931g3sacXFR6KjuLgKLV": {
            category: "Stable",
            tokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            tokenSymbol: "USDT",
        },
        "22DcjMZrMwC5Bpa5AGBsmjc5V9VuQrXG6N9ZtdUNyYGE": {
            category: "LST",
            tokenAddress: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
            tokenSymbol: "mSOL",
        },
        "DMoqjmsuoru986HgfjqrKEvPv8YBufvBGADHUonkadC5": {
            category: "LST",
            tokenAddress: "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp",
            tokenSymbol: "LST",
        },
        "Bohoc1ikHLD7xKJuzTyiTyCwzaL5N7ggJQu75A8mKYM8": {
            category: "LST",
            tokenAddress: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
            tokenSymbol: "JitoSOL",
        },
        "NA": {
            category: "LST",
            tokenAddress: "sctmB7GPi5L2Q5G9tUSzXvhZ4YiDMEGcRov9KfArQpx",
            tokenSymbol: "dfdvSOL",
        },
    };
}

export function getTokenDataMapPartial(): Record<string, TokenData> {
    return {
        "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB": {
            category: "Stable",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenSymbol: "USDC",
        },
        "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh": {
            category: "LST",
            tokenAddress: "So11111111111111111111111111111111111111112",
            tokenSymbol: "SOL",
        },
    };
}

// "NA": {
//     category: "LST",
//         tokenAddress: "sctmB7GPi5L2Q5G9tUSzXvhZ4YiDMEGcRov9KfArQpx",
//         tokenSymbol: "dfdvSOL",
// },


// utils/borrowCurve.ts
export function transformBorrowCurve(curve: [number, number][]) {
    return {
        knots: curve.map(([k]) => k),
        values: curve.map(([, v]) => v),
    };
}


/** Convert 3 vectors into {borrowCurve, lendCurve} points for the chart */
export function vectorsToCurves(v: CurveVectors): {
    borrowCurve: CurvePoint[]
    lendCurve: CurvePoint[]
} {
    const n = Math.min(v.knots.length, v.borrowRates.length, v.lendingRates.length)
    const borrowCurve: CurvePoint[] = new Array(n)
    const lendCurve: CurvePoint[] = new Array(n)
    for (let i = 0; i < n; i++) {
        const u = v.knots[i]
        borrowCurve[i] = { knot: u, rate: v.borrowRates[i] }
        lendCurve[i] = { knot: u, rate: v.lendingRates[i] }
    }
    return { borrowCurve, lendCurve }
}
