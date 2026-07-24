import {
  assetContractId,
  nativeXlmContractId,
  NETWORK_PASSPHRASE,
  type TokenMeta,
} from "./phoenix";
import { Networks } from "@stellar/stellar-sdk";

/**
 * Fallback demo tokens when pools have not been discovered yet.
 * Once pools load, the UI prefers the on-chain token set.
 *
 * Mainnet USDC = Circle issuer GA5ZSEJY…KZVN.
 * Testnet USDC = Circle test issuer GBBD47IF…FLA5.
 */
const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ??
  (NETWORK_PASSPHRASE === Networks.PUBLIC
    ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
    : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

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
