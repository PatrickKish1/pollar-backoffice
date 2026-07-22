import { PoolV2, PositionsEstimate } from "@blend-capital/blend-sdk";
import type { Network } from "@blend-capital/blend-sdk";
import { fromTokenAmount, USDC_DECIMALS } from "./config";

export interface BlendBorrowPositionSnapshot {
  /** Collateral supplied by the user (human-readable). */
  supplied: string;
  /** Outstanding debt from borrowing (human-readable). */
  borrowed: string;
  /** Max borrow capacity (human-readable). */
  borrowCap: string;
  /** Utilized borrow capacity as a fraction (0–1). */
  borrowLimit: number;
  /** Borrow APY for the reserve (e.g. 0.05 = 5%). */
  borrowApy: number;
  /** Borrow APR for the reserve. */
  borrowApr: number;
  /** Supply APY earned on collateral. */
  supplyApy: number;
  /** Latest ledger number. */
  latestLedger: number;
}

export async function fetchBlendBorrowPosition(
  network: Network,
  poolId: string,
  assetId: string,
  userId: string,
): Promise<BlendBorrowPositionSnapshot> {
  const pool = await PoolV2.load(network, poolId);
  const reserve = pool.reserves.get(assetId);

  if (!reserve) {
    throw new Error("USDC reserve not found in pool");
  }

  const user = await pool.loadUser(userId);

  // Read raw position amounts from the reserve.
  const collateral = user.getCollateralFloat(reserve);
  const supply = user.getSupplyFloat(reserve);
  const liabilities = user.getLiabilitiesFloat(reserve);

  const supplied = Math.max(collateral, supply);
  const borrowed = Math.max(liabilities, 0);

  // Load the oracle and build a positions estimate for borrow capacity.
  const oracle = await pool.loadOracle();
  const estimate = PositionsEstimate.build(pool, oracle, user.positions);

  return {
    supplied: fromTokenAmount(
      BigInt(Math.round(supplied * 10 ** USDC_DECIMALS)),
      USDC_DECIMALS,
    ),
    borrowed: fromTokenAmount(
      BigInt(Math.round(borrowed * 10 ** USDC_DECIMALS)),
      USDC_DECIMALS,
    ),
    borrowCap: fromTokenAmount(
      BigInt(Math.round(estimate.borrowCap * 10 ** USDC_DECIMALS)),
      USDC_DECIMALS,
    ),
    borrowLimit: estimate.borrowLimit,
    borrowApy: reserve.estBorrowApy,
    borrowApr: reserve.borrowApr,
    supplyApy: reserve.estSupplyApy,
    latestLedger: reserve.latestLedger,
  };
}
