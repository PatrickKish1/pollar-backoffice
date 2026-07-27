import type { Network } from "@blend-capital/blend-sdk";

export const USDC_DECIMALS = 7;

/** Classic asset behind Blend testnet USDC SAC (from SAC `name()` on-chain). */
export const BLEND_TESTNET_USDC_CODE = "USDC";
export const BLEND_TESTNET_USDC_ISSUER =
  "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56";

export const blendConfig = {
  poolId:
    process.env.NEXT_PUBLIC_BLEND_POOL_ADDRESS ??
    "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  usdcId:
    process.env.NEXT_PUBLIC_BLEND_USDC_ADDRESS ??
    "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
  rpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
    "https://soroban-testnet.stellar.org",
  passphrase:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  pollIntervalMs: 10_000,
} as const;

export function getBlendNetwork(): Network {
  return {
    rpc: blendConfig.rpcUrl,
    passphrase: blendConfig.passphrase,
  };
}

export function getTxExplorerUrl(
  hash: string,
  network: Network = getBlendNetwork(),
): string {
  const isTestnet = network.passphrase.includes("Test");
  const net = isTestnet ? "testnet" : "public";
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}

export function toTokenAmount(value: string, decimals = USDC_DECIMALS): bigint {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined || "0");
}

export function fromTokenAmount(
  amount: bigint,
  decimals = USDC_DECIMALS,
): string {
  const raw = amount.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals) || "0";
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
