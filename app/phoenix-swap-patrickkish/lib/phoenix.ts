/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Phoenix (Stellar AMM) swap helpers — 100% client-side, contract-direct.
 *
 * We intentionally do **not** use `@phoenix-protocol/utils` (last publish 0.0.5,
 * pinned to `soroban-client@1.0.0-beta.2` / Futurenet). That package is obsolete
 * relative to current Soroban + `@stellar/stellar-sdk`. Instead we call the live
 * Phoenix pool / factory ABI with `@stellar/stellar-sdk`, the same pattern as
 * the Aquarius demo in this repo.
 *
 * Pool ABI (from phoenix-contracts):
 *   simulate_swap(offer_asset, offer_amount) -> SimulateSwapResponse
 *   swap(sender, offer_asset, offer_amount, ask_asset_min_amount?,
 *        max_spread_bps?, deadline?, max_allowed_fee_bps?) -> i128
 *   query_config() / query_pool_info()
 *
 * Factory ABI (when a live factory is configured):
 *   query_pools() / query_all_pools_details()
 *   query_for_pool_by_token_pair(token_a, token_b)
 */

import {
  Account,
  Address,
  Asset,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

// --- Config -----------------------------------------------------------------

/**
 * Last published Soroswap aggregator testnet factory (Dec 2025).
 * As of Jul 2026 this contract is **not** live on the current testnet reset
 * (`Storage/MissingValue`). Override with `NEXT_PUBLIC_PHOENIX_FACTORY` once
 * maintainers publish a fresh deploy, or pass seed pools via env.
 */
export const DEFAULT_TESTNET_FACTORY =
  "CB6JW45DDEPUDUQI63AVYXD6UB72HMBGDAW7MZDZKZZIKAB7HL4LTNWO";

/** Known mainnet pools (stellar.expert directory / phoenix-hub.io). */
export const MAINNET_SEED_POOLS = [
  "CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX", // native/USDC
  "CBCZGGNOEUZG4CAAE7TGTQQHETZMKUT4OIPFHHPKEUX46U4KXBBZ3GLH", // native/PHO
  "CD5XNKK3B6BEF2N7ULNHHGAMOKZ7P6456BFNIHRF4WNTEDKBRWAE7IAA", // PHO/USDC
  "CBISULYO5ZGS32WTNCBMEFCNKNSLFXCQ4Z3XHVDP4X4FLPSEALGSY3PS", // native/EURC
  "CC6MJZN3HFOJKXN42ANTSCLRFOMHLFXHWPNAX64DQNUEBDMUYMPHASAV", // EURx/USDC
  "CB5QUVK5GS3IU23TMFZQ3P5J24YBBZP5PHUQAEJ2SP5K55PFTJRUQG2L", // native/EURx
  "CCKOC2LJTPDBKDHTL3M5UO7HFZ2WFIHSOKCELMKQP3TLCIVUBKOQL4HB", // native/GBPx
  "CCUCE5H5CKW3S7JBESGCES6ZGDMWLNRY3HOFET3OH33MXZWKXNJTKSM3", // GBPx/USDC
  "CDMXKSLG5GITGFYERUW2MRYOBUQCMRT2QE5Y4PU3QZ53EBFWUXAXUTBC", // native/USDx
  "CBW5G5SO5SDYUGQVU7RMZ2KJ34POM3AMODOBIV2RQYG4KJDUUBVC3P2T", // USDC/VCHF
  "CDQLKNH3725BUP4HPKQKMM7OO62FDVXVTO7RCYPID527MZHJG2F3QBJW", // USDC/VEUR
] as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? Networks.TESTNET;

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export const FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_PHOENIX_FACTORY ??
  (NETWORK_PASSPHRASE === Networks.PUBLIC ? "" : DEFAULT_TESTNET_FACTORY);

/** Comma-separated pool contract ids. Overrides / supplements factory discovery. */
export function seedPoolAddresses(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_PHOENIX_SEED_POOLS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  if (NETWORK_PASSPHRASE === Networks.PUBLIC) return [...MAINNET_SEED_POOLS];
  return [];
}

export const DECIMALS = 7;

export function getServer(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

export function explorerTxUrl(hash: string): string {
  const network = NETWORK_PASSPHRASE === Networks.PUBLIC ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

// --- Token / trustline helpers ----------------------------------------------

export function nativeXlmContractId(): string {
  return Asset.native().contractId(NETWORK_PASSPHRASE);
}

export function assetContractId(code: string, issuer: string): string {
  return new Asset(code, issuer).contractId(NETWORK_PASSPHRASE);
}

/** Parse classic `CODE:ISSUER` from SAC `name()` when present. */
export function parseClassicFromName(
  name: string,
): { code: string; issuer: string } | null {
  const classicMatch = /^([A-Z0-9]{1,12}):(G[A-Z0-9]{55})$/.exec(name.trim());
  if (!classicMatch) return null;
  return { code: classicMatch[1], issuer: classicMatch[2] };
}

export async function hasTrustline(
  account: string,
  code: string,
  issuer: string,
): Promise<boolean> {
  const response = await fetch(`${HORIZON_URL}/accounts/${account}`);
  if (!response.ok) return false;
  const accountData = await response.json();
  return (accountData.balances ?? []).some(
    (balance: any) =>
      balance.asset_code === code && balance.asset_issuer === issuer,
  );
}

export function toBaseUnits(amount: string | number, decimals = DECIMALS): bigint {
  const [int, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (
    BigInt(int || "0") * BigInt(10) ** BigInt(decimals) +
    BigInt(fracPadded || "0")
  );
}

export function fromBaseUnits(
  amount: bigint | string | number,
  decimals = DECIMALS,
): number {
  return Number(BigInt(amount)) / 10 ** decimals;
}

// --- ScVal helpers ----------------------------------------------------------

const addrScVal = (contractId: string) =>
  Address.fromString(contractId).toScVal();
const i128ScVal = (amount: bigint) => nativeToScVal(amount, { type: "i128" });
const i64ScVal = (amount: number | bigint) =>
  nativeToScVal(amount, { type: "i64" });
/** Soroban `Option::None` → Void; `Some(value)` → the inner ScVal. */
const optScVal = (value: xdr.ScVal | null) => value ?? nativeToScVal(null);

// --- Simulation -------------------------------------------------------------

async function getAccountOrDummy(
  server: rpc.Server,
  from: string,
): Promise<Account> {
  return server.getAccount(from).catch(() => new Account(from, "0"));
}

async function simulateRead(
  server: rpc.Server,
  from: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const readTx = new TransactionBuilder(await getAccountOrDummy(server, from), {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();

  const simulation = await server.simulateTransaction(readTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`${method}: ${simulation.error.split("\n")[0]}`);
  }
  const retval = (simulation as rpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!retval) throw new Error(`${method} returned no value`);
  return retval;
}

// --- Types ------------------------------------------------------------------

export interface TokenMeta {
  contractId: string;
  symbol: string;
  decimals: number;
  name: string;
  /** True when SAC symbol/name is native XLM. */
  native?: boolean;
  code?: string;
  issuer?: string;
}

export interface PoolInfo {
  address: string;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  totalFeeBps: number;
}

export interface Quote {
  outAmount: bigint;
  commissionAmount: bigint;
  spreadAmount: bigint;
  totalReturn: bigint;
  /** Fraction 0.01 = 1%. Prefer spread/total_return; fall back to spot vs exec. */
  priceImpact: number;
  pool: PoolInfo;
}

// --- Token metadata ---------------------------------------------------------

export async function fetchTokenMeta(
  contractId: string,
  from = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  server?: rpc.Server,
): Promise<TokenMeta> {
  const rpcServer = server ?? getServer();
  if (contractId === nativeXlmContractId()) {
    return {
      contractId,
      symbol: "XLM",
      decimals: 7,
      name: "native",
      native: true,
    };
  }

  let symbol = contractId.slice(0, 6);
  let decimals = DECIMALS;
  let name = contractId;
  try {
    symbol = String(
      scValToNative(
        await simulateRead(rpcServer, from, contractId, "symbol", []),
      ),
    );
  } catch {
    /* keep fallback */
  }
  try {
    decimals = Number(
      scValToNative(
        await simulateRead(rpcServer, from, contractId, "decimals", []),
      ),
    );
  } catch {
    /* keep fallback */
  }
  try {
    name = String(
      scValToNative(await simulateRead(rpcServer, from, contractId, "name", [])),
    );
  } catch {
    /* keep fallback */
  }

  const classic = parseClassicFromName(name);
  const native =
    symbol === "native" || name === "native" || contractId === nativeXlmContractId();

  return {
    contractId,
    symbol: native ? "XLM" : symbol,
    decimals,
    name,
    native: native || undefined,
    code: classic?.code,
    issuer: classic?.issuer,
  };
}

// --- Pool discovery ---------------------------------------------------------

function normalizePoolDetails(raw: any, fallbackAddress?: string): PoolInfo | null {
  try {
    // Factory LiquidityPoolInfo shape
    if (raw?.pool_response) {
      const poolResponse = raw.pool_response;
      return {
        address: String(raw.pool_address ?? fallbackAddress),
        tokenA: String(poolResponse.asset_a.address),
        tokenB: String(poolResponse.asset_b.address),
        reserveA: BigInt(poolResponse.asset_a.amount),
        reserveB: BigInt(poolResponse.asset_b.amount),
        totalFeeBps: Number(raw.total_fee_bps ?? 0),
      };
    }
    // Pool query_pool_info shape (PoolResponse)
    if (raw?.asset_a) {
      return {
        address: String(fallbackAddress),
        tokenA: String(raw.asset_a.address),
        tokenB: String(raw.asset_b.address),
        reserveA: BigInt(raw.asset_a.amount),
        reserveB: BigInt(raw.asset_b.amount),
        totalFeeBps: 0,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadPoolInfo(
  poolAddress: string,
  from: string,
  server?: rpc.Server,
): Promise<PoolInfo> {
  const rpcServer = server ?? getServer();
  try {
    const retval = await simulateRead(
      rpcServer,
      from,
      poolAddress,
      "query_pool_info",
      [],
    );
    const info = normalizePoolDetails(scValToNative(retval), poolAddress);
    if (info) {
      try {
        const config = scValToNative(
          await simulateRead(rpcServer, from, poolAddress, "query_config", []),
        ) as any;
        info.totalFeeBps = Number(config.total_fee_bps ?? info.totalFeeBps);
      } catch {
        /* optional */
      }
      return info;
    }
  } catch {
    /* fall through to query_config */
  }

  const config = scValToNative(
    await simulateRead(rpcServer, from, poolAddress, "query_config", []),
  ) as any;
  return {
    address: poolAddress,
    tokenA: String(config.token_a),
    tokenB: String(config.token_b),
    reserveA: BigInt(0),
    reserveB: BigInt(0),
    totalFeeBps: Number(config.total_fee_bps ?? 0),
  };
}

/**
 * Discover every reachable Phoenix pool: factory (if live) ∪ seed env ∪
 * mainnet seeds when on public network.
 */
export async function discoverPools(params: {
  from: string;
  server?: rpc.Server;
}): Promise<PoolInfo[]> {
  const server = params.server ?? getServer();
  const poolsByAddress = new Map<string, PoolInfo>();

  if (FACTORY_ADDRESS) {
    try {
      const retval = await simulateRead(
        server,
        params.from,
        FACTORY_ADDRESS,
        "query_all_pools_details",
        [],
      );
      const list = scValToNative(retval) as any[];
      for (const raw of list ?? []) {
        const info = normalizePoolDetails(raw);
        if (info?.address) poolsByAddress.set(info.address, info);
      }
    } catch {
      try {
        const retval = await simulateRead(
          server,
          params.from,
          FACTORY_ADDRESS,
          "query_pools",
          [],
        );
        const addresses = scValToNative(retval) as string[];
        for (const address of addresses ?? []) {
          try {
            poolsByAddress.set(
              address,
              await loadPoolInfo(address, params.from, server),
            );
          } catch {
            /* skip dead pool */
          }
        }
      } catch {
        /* factory not live on this network */
      }
    }
  }

  for (const address of seedPoolAddresses()) {
    if (poolsByAddress.has(address)) continue;
    try {
      poolsByAddress.set(
        address,
        await loadPoolInfo(address, params.from, server),
      );
    } catch {
      /* skip */
    }
  }

  return [...poolsByAddress.values()];
}

export function poolsForPair(
  pools: PoolInfo[],
  tokenIn: string,
  tokenOut: string,
): PoolInfo[] {
  return pools.filter(
    (pool) =>
      (pool.tokenA === tokenIn && pool.tokenB === tokenOut) ||
      (pool.tokenA === tokenOut && pool.tokenB === tokenIn),
  );
}

/** Unique tokens across discovered pools, with on-chain metadata. */
export async function tokensFromPools(
  pools: PoolInfo[],
  from: string,
  server?: rpc.Server,
): Promise<TokenMeta[]> {
  const contractIds = new Set<string>();
  for (const pool of pools) {
    contractIds.add(pool.tokenA);
    contractIds.add(pool.tokenB);
  }
  const metas: TokenMeta[] = [];
  for (const contractId of contractIds) {
    try {
      metas.push(await fetchTokenMeta(contractId, from, server));
    } catch {
      metas.push({
        contractId,
        symbol: contractId.slice(0, 6),
        decimals: DECIMALS,
        name: contractId,
      });
    }
  }
  metas.sort((left, right) => left.symbol.localeCompare(right.symbol));
  return metas;
}

// --- Quote ------------------------------------------------------------------

export async function simulateSwapOnPool(params: {
  from: string;
  pool: PoolInfo;
  offerAsset: string;
  offerAmount: bigint;
  server?: rpc.Server;
}): Promise<{
  askAmount: bigint;
  commissionAmount: bigint;
  spreadAmount: bigint;
  totalReturn: bigint;
}> {
  const server = params.server ?? getServer();
  const retval = await simulateRead(
    server,
    params.from,
    params.pool.address,
    "simulate_swap",
    [addrScVal(params.offerAsset), i128ScVal(params.offerAmount)],
  );
  const raw = scValToNative(retval) as any;
  return {
    askAmount: BigInt(raw.ask_amount),
    commissionAmount: BigInt(raw.commission_amount),
    spreadAmount: BigInt(raw.spread_amount),
    totalReturn: BigInt(raw.total_return),
  };
}

export async function quoteBestSwap(params: {
  from: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  pools?: PoolInfo[];
  server?: rpc.Server;
}): Promise<Quote> {
  const server = params.server ?? getServer();
  const pools =
    params.pools ??
    poolsForPair(
      await discoverPools({ from: params.from, server }),
      params.tokenIn,
      params.tokenOut,
    );
  const candidates = poolsForPair(pools, params.tokenIn, params.tokenOut);
  if (!candidates.length) {
    throw new Error(
      "No Phoenix pool for this pair. Set NEXT_PUBLIC_PHOENIX_FACTORY or NEXT_PUBLIC_PHOENIX_SEED_POOLS once a live testnet deploy is available.",
    );
  }

  const results = await Promise.all(
    candidates.map(async (pool) => {
      try {
        const swapSim = await simulateSwapOnPool({
          from: params.from,
          pool,
          offerAsset: params.tokenIn,
          offerAmount: params.amountIn,
          server,
        });
        return { pool, sim: swapSim };
      } catch {
        return null;
      }
    }),
  );

  const successfulQuotes = results.filter(Boolean) as {
    pool: PoolInfo;
    sim: Awaited<ReturnType<typeof simulateSwapOnPool>>;
  }[];
  if (!successfulQuotes.length) throw new Error("No pool could quote this swap");

  const best = successfulQuotes.reduce((currentBest, candidate) =>
    candidate.sim.askAmount > currentBest.sim.askAmount ? candidate : currentBest,
  );

  let priceImpact = 0;
  if (best.sim.totalReturn > BigInt(0)) {
    priceImpact = Number(best.sim.spreadAmount) / Number(best.sim.totalReturn);
  } else {
    try {
      const referenceAmount = BigInt(10) ** BigInt(DECIMALS);
      const referenceSim = await simulateSwapOnPool({
        from: params.from,
        pool: best.pool,
        offerAsset: params.tokenIn,
        offerAmount: referenceAmount,
        server,
      });
      const spotRate =
        Number(referenceSim.askAmount) / Number(referenceAmount);
      const execRate = Number(best.sim.askAmount) / Number(params.amountIn);
      if (spotRate > 0) priceImpact = Math.max(0, 1 - execRate / spotRate);
    } catch {
      /* leave 0 */
    }
  }

  return {
    outAmount: best.sim.askAmount,
    commissionAmount: best.sim.commissionAmount,
    spreadAmount: best.sim.spreadAmount,
    totalReturn: best.sim.totalReturn,
    priceImpact,
    pool: best.pool,
  };
}

// --- Build swap XDR ---------------------------------------------------------

export interface BuildPhoenixSwapArgs {
  from: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  /** Minimum ask amount (slippage guard). Mapped to `ask_asset_min_amount`. */
  minAmountOut: bigint;
  /** Max spread in bps (optional). Defaults to a generous 1000 (10%). */
  maxSpreadBps?: number;
  pool?: PoolInfo;
  pools?: PoolInfo[];
  server?: rpc.Server;
}

/**
 * Builds, simulates and assembles a Phoenix pool `swap`, returning the
 * **unsigned XDR** ready for Pollar `signAndSubmitTx`.
 */
export async function buildPhoenixSwapXdr(
  args: BuildPhoenixSwapArgs,
): Promise<string> {
  const server = args.server ?? getServer();
  let pool = args.pool;
  if (!pool) {
    const quote = await quoteBestSwap({
      from: args.from,
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      amountIn: args.amountIn,
      pools: args.pools,
      server,
    });
    pool = quote.pool;
  }

  const maxSpreadBps = args.maxSpreadBps ?? 1000;
  const account = await server.getAccount(args.from);
  const swapOperation = new Contract(pool.address).call(
    "swap",
    addrScVal(args.from),
    addrScVal(args.tokenIn),
    i128ScVal(args.amountIn),
    optScVal(i128ScVal(args.minAmountOut)),
    optScVal(i64ScVal(maxSpreadBps)),
    optScVal(null),
    optScVal(null),
  );

  const unsignedTx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(swapOperation)
    .setTimeout(180)
    .build();

  const simulation = await server.simulateTransaction(unsignedTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(
      `swap simulation failed: ${simulation.error.split("\n")[0]}`,
    );
  }

  return rpc.assembleTransaction(unsignedTx, simulation).build().toXDR();
}
