import {
  assetContractId,
  nativeXlmContractId,
  type TokenMeta,
} from "./phoenix";

/**
 * Fallback demo tokens when the factory / seed pools have not been discovered
 * yet (current public Phoenix testnet factory is stale after network resets).
 * Once pools load, the UI prefers the on-chain token set.
 */
const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const XLM: TokenMeta = {
  symbol: "XLM",
  contractId: nativeXlmContractId(),
  decimals: 7,
  name: "native",
  native: true,
};

export const USDC: TokenMeta = {
  symbol: "USDC",
  contractId: assetContractId("USDC", USDC_ISSUER),
  decimals: 7,
  name: `USDC:${USDC_ISSUER}`,
  code: "USDC",
  issuer: USDC_ISSUER,
};

export const FALLBACK_TOKENS: TokenMeta[] = [XLM, USDC];

export function mergeTokens(
  discovered: TokenMeta[],
  fallback: TokenMeta[] = FALLBACK_TOKENS,
): TokenMeta[] {
  const byContractId = new Map<string, TokenMeta>();
  for (const token of fallback) byContractId.set(token.contractId, token);
  for (const token of discovered) byContractId.set(token.contractId, token);
  return [...byContractId.values()].sort((left, right) =>
    left.symbol.localeCompare(right.symbol),
  );
}
