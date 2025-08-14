export type ProtocolDataRow = {
  protocol: string;
  token: string;
  liquidity: number | string;
  currentUtilization: number | string;
  targetUtilization: number | string;
  plateauRate: number | string;
  maxRate: number | string;
  lendingRate: number | string;
  borrowingRate: number | string;
  collateralWeight: number | string;
  liabilityWeight: number | string;
  ltv: number | string;
};
