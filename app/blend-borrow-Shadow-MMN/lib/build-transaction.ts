import {
  PoolContractV2,
  RequestType,
  type Network,
} from "@blend-capital/blend-sdk";
import {
  BASE_FEE,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

export interface BlendTxParams {
  pool: string;
  asset: string;
  from: string;
  amount: bigint;
  network: Network;
}

function buildSubmitOperation(
  pool: string,
  from: string,
  asset: string,
  amount: bigint,
  requestType: RequestType,
): string {
  const poolContract = new PoolContractV2(pool);
  return poolContract.submit({
    from,
    spender: from,
    to: from,
    requests: [
      {
        request_type: requestType,
        address: asset,
        amount,
      },
    ],
  });
}

async function simulateToUnsignedXdr(
  from: string,
  operationXdr: string,
  network: Network,
): Promise<string> {
  const stellarRpc = new rpc.Server(network.rpc);
  const account = await stellarRpc.getAccount(from);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(xdr.Operation.fromXDR(operationXdr, "base64"))
    .setTimeout(300)
    .build();

  const simulation = await stellarRpc.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error("Blend transaction simulation failed");
  }

  return rpc
    .assembleTransaction(transaction, simulation)
    .build()
    .toXDR();
}

/**
 * Build an unsigned XDR for borrowing an asset from a Blend pool.
 *
 * The user must have already supplied collateral (via Earn deposit) and
 * have sufficient borrow capacity.
 *
 * The returned XDR is ready for Pollar's `signAndSubmitTx`.
 */
export async function buildBlendBorrowXdr(
  params: BlendTxParams,
): Promise<string> {
  const operation = buildSubmitOperation(
    params.pool,
    params.from,
    params.asset,
    params.amount,
    RequestType.Borrow,
  );

  return simulateToUnsignedXdr(params.from, operation, params.network);
}

/**
 * Build an unsigned XDR for repaying a borrowed asset to a Blend pool.
 *
 * The user must have an outstanding borrow position and sufficient
 * balance of the borrowed asset.
 *
 * The returned XDR is ready for Pollar's `signAndSubmitTx`.
 */
export async function buildBlendRepayXdr(
  params: BlendTxParams,
): Promise<string> {
  const operation = buildSubmitOperation(
    params.pool,
    params.from,
    params.asset,
    params.amount,
    RequestType.Repay,
  );

  return simulateToUnsignedXdr(params.from, operation, params.network);
}
