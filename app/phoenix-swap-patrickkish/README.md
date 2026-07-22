# Phoenix × Pollar — AMM swap signed with Pollar

Route: **`/phoenix-swap-patrickkish`**

Client-side Phoenix pool swaps on Stellar, built with `@stellar/stellar-sdk` and
submitted via Pollar `signAndSubmitTx`. Tokens and pools are discovered on-chain
whenever a live factory or seed pool list is available.

| File | Role |
| ---- | ---- |
| [`lib/phoenix.ts`](./lib/phoenix.ts) | `buildPhoenixSwapXdr`, quotes, pool/token discovery |
| [`lib/tokens.ts`](./lib/tokens.ts) | Fallback XLM/USDC + merge helpers |
| [`page.tsx`](./page.tsx) | UI |

## Why not `@phoenix-protocol/utils`?

The only published npm package (`@phoenix-protocol/utils@0.0.5`) depends on
**`soroban-client@1.0.0-beta.2`** and targets **Futurenet**. It is not maintained
for current Soroban / Stellar testnet or mainnet, and would fight the repo’s
`@stellar/stellar-sdk` already used by Aquarius / Blend / Soroswap demos.

Issue #28 asks for Phoenix SDK *or* contract bindings. We use the **current
Phoenix contract ABI** (factory + pool from
[phoenix-contracts](https://github.com/Phoenix-Protocol-Group/phoenix-contracts))
directly — same approach as Aquarius in this repo (“no Aquarius JS SDK”).

## Testnet pools (current status)

| Source | Address | Status (Jul 2026) |
| ------ | ------- | ----------------- |
| Soroswap aggregator `testnet.contracts.json` factory | `CB6JW45D…TNWO` | **Dead** after testnet reset (`Storage/MissingValue`) |
| stellar.expert “Phoenix Pool” directory entries | various `C…` | **Mainnet only** (same IDs do not exist on testnet) |
| Maintainer-assigned pool (issue “What you need”) | TBD | Not posted in the GrantFox assignment comment |

So there is **no public live Phoenix factory/pool on the current testnet** that
we could verify. The integration is complete against the live ABI; the signing
spike and demo video need either:

1. Maintainer-confirmed testnet factory/pool + allowlist/fee (per issue), or  
2. `NEXT_PUBLIC_PHOENIX_FACTORY` / `NEXT_PUBLIC_PHOENIX_SEED_POOLS` pointing at a
   fresh deploy.

Mainnet reference pools (for ABI / pair sanity checks only — **do not** sign
mainnet txs with a Pollar testnet wallet) are seeded automatically when
`NEXT_PUBLIC_NETWORK_PASSPHRASE` is the public network. Examples:

- `CBHCRSVX…BIZX` — XLM / USDC  
- `CBCZGGNO…Z3GLH` — XLM / PHO  
- `CD5XNKK3…E7IAA` — PHO / USDC  

Tokens supported in the UI = **whatever those pools expose** (SAC `symbol` /
`name` / `decimals`), not a fixed two-asset hardcode.

## Package bumps

This app is a **single** Next.js package. Issue #28 only allows touching the
root `package.json` for shared deps (there is no per-route `package.json`).

- `@pollar/core` / `@pollar/react` → **`^0.11.0`** (acceptance criteria)
- **No** `@phoenix-protocol/utils` added (see above)
- `@stellar/stellar-sdk` already present — used for all Phoenix calls

Pollar 0.11 renames `walletAddress` → `wallet.address` and `sponsored` →
`skipSponsorship`, and requires `application.network` / `application.chains`
when supplying a local `appConfig`. The shared provider + existing demos were
updated with those renames so the required `^0.11.0` pin still typechecks; the
Phoenix route itself stays under this folder.
## Run

```bash
npm install
npm run dev   # http://localhost:3000/phoenix-swap-patrickkish
```

Authorize `http://localhost:3000` under Pollar **Configuration → Domains**.

### Environment

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Pollar key | required (app provider) |
| `NEXT_PUBLIC_POLLAR_NETWORK` | `testnet` / `mainnet` | `testnet` |
| `NEXT_PUBLIC_PHOENIX_FACTORY` | Phoenix factory | last known Soroswap testnet factory (likely stale) |
| `NEXT_PUBLIC_PHOENIX_SEED_POOLS` | Comma-separated pool contract ids | empty on testnet; mainnet seed list on public network |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon (trustlines) | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase | Test SDF Network ; September 2015 |
| `NEXT_PUBLIC_USDC_ISSUER` | Fallback USDC issuer | Circle testnet |

Example once a live testnet pool exists:

```bash
NEXT_PUBLIC_PHOENIX_SEED_POOLS=C…pool…
# and/or
NEXT_PUBLIC_PHOENIX_FACTORY=C…factory…
```

Dashboard (confirmed at assignment): Auth Policy allowlist for the Phoenix pool
(+ token SACs) and a high enough max fee for Soroban.

## Flow

1. Discover pools via factory (`query_all_pools_details` / `query_pools`) and/or seed list.  
2. Build the token picker from unique pool assets (on-chain metadata).  
3. Live quote via pool `simulate_swap` (best ask across matching pools).  
4. Slippage → `ask_asset_min_amount` + `max_spread_bps`.  
5. `buildPhoenixSwapXdr` → simulate/assemble → `signAndSubmitTx`.  
6. Missing classic buy-asset trustline → Pollar `setTrustline`.

```ts
import { buildPhoenixSwapXdr } from "./lib/phoenix";

const xdr = await buildPhoenixSwapXdr({
  from: walletAddress,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
});
await signAndSubmitTx(xdr);
```

## Signing spike

**Blocked on a live testnet Phoenix pool** (see table above). Once
`NEXT_PUBLIC_PHOENIX_SEED_POOLS` (or a working factory) is set and Auth Policy /
fee caps are applied:

1. Friendbot XLM; fund the sell asset.  
2. Swap both directions; paste explorer links here.  
3. Document any allowlist / fee-cap rejects and the dashboard fix.

## Acceptance criteria checklist

- [ ] Signing spike on testnet (needs live pool + allowlist)  
- [x] `buildPhoenixSwapXdr` isolated  
- [x] Live quote + price impact + slippage min-out  
- [x] Trustline handling via `setTrustline`  
- [x] Uses `usePollar()` address  
- [x] Work under this folder; root `package.json` Pollar bump only (no obsolete Phoenix utils)  
- [x] Pins `@pollar/core@^0.11.0`, `@pollar/react@^0.11.0`  
- [x] README with pool/env notes  
- [ ] Demo video  
