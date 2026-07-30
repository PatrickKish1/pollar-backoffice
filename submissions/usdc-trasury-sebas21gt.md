# Submission: Multi-chain USDC Treasury Engine (CCTP v2)

**Issue:** [#31](https://github.com/pollar-xyz/pollar-backoffice/issues/31)
**Nickname:** sebas21gt
**Repo:** https://github.com/Sebas21gt/usdc-treasury-sebas21gt
**Demo video:** https://drive.google.com/file/d/1fWJnrpMT6odgKchqfeHOep7hS4EvdRBx/view?usp=sharing

## What it is

A multi-chain USDC treasury engine running on testnet across Stellar, Solana,
and Polygon Amoy, rebalanced with CCTP v2 (Circle's native burn-and-mint,
Standard transfer only — no third-party bridges). Manual and automatic
rebalancing modes, both backed by the same `transferUsdc`/`executeBurn`/
`executeMint` functions in the engine. The Stellar treasury wallet is a
Pollar custodial wallet; every Stellar-side CCTP transaction is signed with
`signAndSubmitTx`.

## Spike results (testnet, verified)

**Polygon Amoy → Solana devnet**
- Burn: [`0x58eac64bda8a94e005a8088b7c3d159a944132234dee59f71f1140d23ca65517`](https://amoy.polygo8a94e005a8088b7c3d159a944132234dee59f71f1140d23ca65517)
- Mint: [`3c6VDhTnGWFiSD9WM8RDy2rKj2kKyR9Ja4EaDkGppgCvksCjLJLvZjcZfor8bgDgbsAjc8kf1wwuKFUVXX7B5Z14`](https://explorer.solana.com/tx/3c6VDhTnGWFiSD9WM8RDy2rKj2kKyR9Ja4EaDkGppgCvksCjLJLvZjcZfor8bgDgbsAjc8kf1wwuKFUVXX7B5Z14?cluster=devnet)

**Stellar → Polygon** (burn signed with Pollar's `signAndSubmitTx`)
- Approve: [`91a9286e1ad14ef4112490ad66bcdbde629b718aabf53a9c6e507d22fc071c9a`](https://stellar.expert/explorer/testnet/tx/91a9286e1ad14ef4112490ad66bcdbde629b718aabf53a9c6e507d22fc071c9a)
- Burn: [`63372283c038c38cd1c8cf6141562774a8c5ed68958d446bc598cb564c95abfe`](https://stellar.exper72283c038c38cd1c8cf6141562774a8c5ed68958d446bc598cb564c95abfe)
- Mint: [`0xefc49b84c24dfc1437b3ec113328c78a38bd791662bebf87a72e1545a3cc00b1`](https://amoy.polygonscan.com/tx/0xefc49b84c24dfc1437b3ec113328c78a38bd791662bebf87a72e1545a3cc00b1)

**Polygon → Stellar** (mint via `CctpForwarder` into the Pollar account)
- Burn: [`0xa3aab8d8a41e8eba8e6ea8fa2dc4b3d6dfc529155103e89682679a58f76960f5`](https://amoy.polygonscan.com/tx/0xa3aab8d8a41e8eba8e6ea8fa2dc4b3d6dfc529155103e89682679a58f76960f5)
- Mint: [`71157ba6f6b8a542a70547e3898eacb5098442448ddcf563e88afcd8693f62ff`](https://stellar.expert/explorer/testnet/tx/71157ba6f6b8a542a70547e3898eacb5098442448ddcf563e88afcd8693f62ff)

On the Auth Policy gotcha: once `TokenMessengerMinter`, `MessageTransmitter`,
and `CctpForwarder` were allowlisted in Treasury → Auth Policy, `signAndSubmitTx`
signed the CCTP XDRs (built with `@stellar/stellar-sdk`'s `Contract.call(...)`)
as-is — no workaround needed beyond the allowlist itself.

## Deliverables

- [x] EVM/Solana spike passes end to end on testnet
- [x] Stellar spike passes in both directions
- [x] Transfer construction isolated in reusable functions (`transferUsdc`, `executeBurn`, `executeMint`, per-chain builders)
- [x] Declarative per-network config (min/target/max, RPC, contracts)
- [x] Inventory monitor (standalone engine process, `npm run monitor`)
- [x] Automatic mode: threshold detection, rebalance to target, max-per-move + cooldown (`npm run automatic`)
- [x] Manual mode from the frontend, reusing the same functions
- [x] Every move recorded in `data/history.json` with explorer-verifiable hashes
- [x] Frontend: inventories, range status, history, manual rebalance form
- [x] CCTP v2 Standard only, no third-party bridges
- [x] Pins `@pollar/core@^0.11.2`, `@pollar/react@^0.11.2`
- [x] README with setup, faucets, level config, Auth Policy allowlist steps, how to run both modes
- [x] Demo video attached