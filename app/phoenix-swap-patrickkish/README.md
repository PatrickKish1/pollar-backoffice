# Phoenix × Pollar — AMM swap signed with Pollar

Route: **`/phoenix-swap-patrickkish`**

Client-side Phoenix pool swaps on Stellar, built with `@stellar/stellar-sdk` and
submitted via Pollar `signAndSubmitTx`. Tokens and pools are discovered on-chain
from seed pools (and factory when configured).

| File | Role |
| ---- | ---- |
| [`lib/phoenix.ts`](./lib/phoenix.ts) | `buildPhoenixSwapXdr`, quotes, pool/token discovery |
| [`lib/tokens.ts`](./lib/tokens.ts) | Fallback XLM/USDC + merge helpers |
| [`page.tsx`](./page.tsx) | UI |

## Why not `@phoenix-protocol/utils`?

The only published npm package (`@phoenix-protocol/utils@0.0.5`) depends on
**`soroban-client@1.0.0-beta.2`** and targets **Futurenet**. It is not maintained
for current Soroban / Stellar networks, and would fight the repo’s
`@stellar/stellar-sdk` already used by Aquarius / Blend / Soroswap demos.

Issue #28 asks for Phoenix SDK *or* contract bindings. We use the **current
Phoenix contract ABI** (factory + pool from
[phoenix-contracts](https://github.com/Phoenix-Protocol-Group/phoenix-contracts))
directly — same approach as Aquarius in this repo (“no Aquarius JS SDK”).

## Network: mainnet (issue updated)

Phoenix Hub has **no live public testnet pools** after the Stellar testnet reset
(old Soroswap factory `CB6JW45D…` → `Contract not found`). Pollar accepted
completing the spike + demo on **mainnet**.

### Demo pool

| Field | Value |
| ----- | ----- |
| Pool | [`CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX`](https://stellar.expert/explorer/public/contract/CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX) |
| Pair | **XLM ↔ USDC** (Circle issuer `GA5ZSEJY…KZVN`) |
| Hub | https://app.phoenix-hub.io/pools/CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX |

Other mainnet seed pools (PHO, EURC, …) are listed in `lib/phoenix.ts` →
`MAINNET_SEED_POOLS` and load automatically when
`NEXT_PUBLIC_POLLAR_NETWORK=mainnet`.

Tokens in the UI = whatever those pools expose on-chain (SAC `symbol` /
`name` / `decimals`).

## Package bumps

This app is a **single** Next.js package. Issue #28 only allows touching the
root `package.json` for shared deps (there is no per-route `package.json`).

- `@pollar/core` / `@pollar/react` → **`^0.11.0`** (acceptance criteria)
- **No** `@phoenix-protocol/utils` added (see above)
- `@stellar/stellar-sdk` already present — used for all Phoenix calls

## Run

```bash
npm install
npm run dev   # http://localhost:3000/phoenix-swap-patrickkish
```

1. Create / use a **mainnet** Pollar app key (`pub_mainnet_…`) at
   https://dashboard.pollar.xyz  
2. Authorize `http://localhost:3000` under **Configuration → Domains**  
3. **Treasury → Transaction Policy** → raise max fee toward **100 XLM**  
   (Auth Policy allowlist is not required for `signAndSubmitTx`)  
4. Fund the custodial G-address with a little **XLM** + **USDC** (real mainnet)

### Environment

| Variable | Purpose | Mainnet value |
| -------- | ------- | ------------- |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Pollar key | `pub_mainnet_…` |
| `NEXT_PUBLIC_POLLAR_NETWORK` | Pollar + Phoenix network | `mainnet` |
| `NEXT_PUBLIC_PHOENIX_SEED_POOLS` | Pool override (optional) | defaults to `MAINNET_SEED_POOLS` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC | `https://mainnet.sorobanrpc.com` (not `soroban.stellar.org`) |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon | `https://horizon.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Passphrase | `Public Global Stellar Network ; September 2015` |
| `NEXT_PUBLIC_USDC_ISSUER` | Fallback USDC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |

Minimal `.env.local`:

```bash
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_mainnet_…
NEXT_PUBLIC_POLLAR_NETWORK=mainnet
NEXT_PUBLIC_PHOENIX_SEED_POOLS=CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX
```

Passphrase / RPC / Horizon / Circle USDC issuer are inferred from
`NEXT_PUBLIC_POLLAR_NETWORK=mainnet` when unset.

## Flow

1. Discover pools via seed list (mainnet defaults) and/or factory.  
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

## Signing spike (mainnet)

1. Login with Pollar (custodial G-address) on mainnet.  
2. Ensure fee cap ≥ expected Soroban fee; fund XLM + USDC.  
3. Swap a **tiny** amount both directions on `CBHCRSVX…BIZX`.  
4. Paste stellar.expert `/explorer/public/tx/…` links here.  
5. Note any fee-cap rejects and the dashboard fix.  
6. Keep an eye on Pollar’s **5-operation** tx limit.

Liquidity add reference (same pool):  
https://stellar.expert/explorer/public/tx/3e7aa7fd110b1d315727c338137f7cf877e61406ff43f6849a0044a17fad1030

## Acceptance criteria checklist

- [ ] Signing spike on mainnet (`signAndSubmitTx` against live Phoenix pool)  
- [x] `buildPhoenixSwapXdr` isolated  
- [x] Live quote + price impact + slippage min-out  
- [x] Trustline handling via `setTrustline`  
- [x] Uses `usePollar()` address  
- [x] Work under this folder; root `package.json` Pollar bump only (no obsolete Phoenix utils)  
- [x] Pins `@pollar/core@^0.11.0`, `@pollar/react@^0.11.0`  
- [x] README with pool/env notes  
- [ ] Demo video  
