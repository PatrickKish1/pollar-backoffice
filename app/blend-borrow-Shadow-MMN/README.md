# Blend Borrow + Repay (Shadow-MMN)

Client-side Blend borrow + repay integration for issue [#27](https://github.com/pollar-xyz/pollar-backoffice/issues/27).

## Route

```
/blend-borrow-Shadow-MMN
```

## How it works

1. Deposit USDC as collateral on `/blend-patrickkish` (native Earn flow).
2. Go to `/blend-borrow-Shadow-MMN` to:
   - **View** your position (collateral, debt, borrow limit, APYs).
   - **Borrow** USDC against your collateral — signed with Pollar `signAndSubmitTx`.
   - **Repay** borrowed USDC — signed with Pollar `signAndSubmitTx`.

Everything is **contract-direct** — no backend, no API keys. The XDR is built on
the client, simulated against Soroban testnet RPC, and handed to Pollar for
signing and submission.

## Run

From the repo root:

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_...
npm install
npm run dev
```

Open `http://localhost:3000/blend-borrow-Shadow-MMN`.

## Environment variables

| Variable | Required | Default (testnet) |
|----------|----------|-------------------|
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | yes | — |
| `NEXT_PUBLIC_POLLAR_NETWORK` | no | `testnet` |
| `NEXT_PUBLIC_BLEND_POOL_ADDRESS` | no | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |
| `NEXT_PUBLIC_BLEND_USDC_ADDRESS` | no | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | no | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | no | `Test SDF Network ; September 2015` |

Testnet addresses come from [blend-utils/testnet.contracts.json](https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json).

## Testnet pool & assets

| | |
|---|---|
| **Pool** | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` (TestnetV2) |
| **USDC code** | `USDC` |
| **USDC classic issuer** | `GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56` |
| **USDC SAC contract** | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

This is **Blend's own testnet USDC** — not Circle testnet USDC.

## Reusable code

The following two functions are isolated so they can be moved into a Pollar
adapter later:

| Function | File |
|---|---|
| `buildBlendBorrowXdr({ pool, asset, from, amount, network })` | `lib/build-transaction.ts` |
| `buildBlendRepayXdr({ pool, asset, from, amount, network })` | `lib/build-transaction.ts` |

## Position data

`lib/pool-data.ts` exposes `fetchBlendBorrowPosition()` which returns:

- `supplied` — USDC supplied as collateral
- `borrowed` — USDC borrowed
- `borrowCap` — max borrow capacity (oracle-priced)
- `borrowLimit` — utilized borrow capacity ratio
- `borrowApy` / `borrowApr` — current borrow interest rates
- `supplyApy` — current supply interest rate

Live polling every 10 seconds.

## Structure

```
app/blend-borrow-Shadow-MMN/
  lib/
    build-transaction.ts     # buildBlendBorrowXdr, buildBlendRepayXdr
    pool-data.ts             # position data with oracle-based borrow capacity
    config.ts                # env vars, network, amount helpers
    parse-blend-error.ts     # user-friendly error messages
  page.tsx                   # borrow + repay UI
  README.md                  # this file
```

## Demo checklist

- [ ] Supply USDC on `/blend-patrickkish` as collateral (native Earn flow)
- [ ] Borrow USDC on `/blend-borrow-Shadow-MMN` — signed with Pollar
- [ ] Repay borrowed USDC on `/blend-borrow-Shadow-MMN` — signed with Pollar
- [ ] Position dashboard shows correct collateral, debt, and APYs
- [ ] Attach a short screen recording to the PR
