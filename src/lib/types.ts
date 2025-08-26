export type ProtocolDataRow = {
  protocol: string;
  token: string;
  liquidity: number | string;
  currentUtilization: number | string;
  optimalUtilization: number | string;
  plateauRate: number | string;
  maxRate: number | string;
  lendingRate: number | string;
  borrowingRate: number | string;
  collateralWeight: number | string;
  liabilityWeight: number | string;
  ltv: number | string;
};

// Shared curve types for tables & charts

export type CurveVectors = {
  /** x-axis points as percents [0..100] */
  knots: number[]
  /** y-axis borrow rates (same length as util), in % units (e.g., 7.2) */
  borrowRates: number[]
  /** y-axis lend rates (same length as util), in % units (e.g., 5.1) */
  lendingRates: number[]
}

export type CurvePoint = { knot: number; rate: number }

// Extend your existing ProtocolDataRow non-destructively
export type ProtocolRowWithCurves<TBase> = TBase & { curves: CurveVectors }
