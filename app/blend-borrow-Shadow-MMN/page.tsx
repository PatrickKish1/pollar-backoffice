"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePollar } from "@pollar/react";
import {
  blendConfig,
  getBlendNetwork,
  getTxExplorerUrl,
  toTokenAmount,
  USDC_DECIMALS,
} from "./lib/config";
import {
  buildBlendBorrowXdr,
  buildBlendRepayXdr,
} from "./lib/build-transaction";
import { parseBlendError } from "./lib/parse-blend-error";
import {
  fetchBlendBorrowPosition,
  type BlendBorrowPositionSnapshot,
} from "./lib/pool-data";

type BlendAction = "borrow" | "repay";

type TxStatus =
  | { kind: "idle" }
  | { kind: "building"; action: BlendAction }
  | { kind: "signing"; action: BlendAction }
  | { kind: "success"; hash: string; label: string; action: BlendAction }
  | { kind: "error"; message: string; action?: BlendAction };

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition-all focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-tint";

export default function BlendBorrowShadowMMNPage() {
  const {
    isAuthenticated,
    walletAddress,
    walletBalance,
    refreshWalletBalance,
    signAndSubmitTx,
    verified,
    openLoginModal,
    logout,
  } = usePollar();

  const network = useMemo(() => getBlendNetwork(), []);

  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [position, setPosition] = useState<BlendBorrowPositionSnapshot | null>(
    null,
  );
  const [positionError, setPositionError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>({ kind: "idle" });

  // Fetch position data
  const refreshPosition = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const snapshot = await fetchBlendBorrowPosition(
        network,
        blendConfig.poolId,
        blendConfig.usdcId,
        walletAddress,
      );
      setPosition(snapshot);
      setPositionError(null);
    } catch (err) {
      setPositionError(
        parseBlendError(
          err instanceof Error
            ? err.message
            : "Failed to load pool position",
        ),
      );
    }
  }, [network, walletAddress]);

  // Initial data fetch + polling
  useEffect(() => {
    if (!isAuthenticated) return;
    if (walletBalance.step === "idle") void refreshWalletBalance();
  }, [isAuthenticated, walletBalance.step, refreshWalletBalance]);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;
    void refreshPosition();
    const timer = setInterval(
      () => void refreshPosition(),
      blendConfig.pollIntervalMs,
    );
    return () => clearInterval(timer);
  }, [isAuthenticated, walletAddress, refreshPosition]);

  // Derived values
  const usdcBalance = useMemo(() => {
    if (walletBalance.step !== "loaded") return null;
    const usdc = walletBalance.data.balances.find(
      (b) => b.type === "credit_alphanum4" && b.code === "USDC",
    );
    return usdc?.available ?? null;
  }, [walletBalance]);

  const supplied = position ? Number(position.supplied) : 0;
  const borrowed = position ? Number(position.borrowed) : 0;
  const borrowCap = position ? Number(position.borrowCap) : 0;
  const availableToBorrow = Math.max(0, borrowCap - borrowed);
  const hasCollateral = supplied > 0;
  const hasDebt = borrowed > 0;
  const canBorrow =
    hasCollateral && availableToBorrow > 0;
  const canRepay = hasDebt;

  // Submit borrow or repay transaction
  async function submitBlendTx(
    label: string,
    action: BlendAction,
    buildXdr: () => Promise<string>,
  ) {
    setTxStatus({ kind: "building", action });
    try {
      const unsignedXdr = await buildXdr();
      setTxStatus({ kind: "signing", action });
      const outcome = await signAndSubmitTx(unsignedXdr);

      if (outcome.status === "success" || outcome.status === "pending") {
        if (!outcome.hash) {
          setTxStatus({
            kind: "error",
            action,
            message: parseBlendError(
              "Transaction submitted but no hash was returned",
            ),
          });
          return;
        }

        setTxStatus({
          kind: "success",
          hash: outcome.hash,
          label,
          action,
        });
        // Clear the input and refresh data
        if (action === "borrow") setBorrowAmount("");
        else setRepayAmount("");
        void refreshWalletBalance();
        void refreshPosition();
        return;
      }

      setTxStatus({
        kind: "error",
        action,
        message: parseBlendError(
          outcome.details ?? outcome.resultCode ?? "Transaction failed",
        ),
      });
    } catch (err) {
      setTxStatus({
        kind: "error",
        action,
        message: parseBlendError(
          err instanceof Error ? err.message : "Unexpected error",
        ),
      });
    }
  }

  async function handleBorrow(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress || !verified) return;

    const amount = toTokenAmount(borrowAmount);
    if (amount <= BigInt(0)) return;

    await submitBlendTx("Borrow", "borrow", () =>
      buildBlendBorrowXdr({
        pool: blendConfig.poolId,
        asset: blendConfig.usdcId,
        from: walletAddress,
        amount,
        network,
      }),
    );
  }

  async function handleRepay(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress || !verified) return;

    const amount = toTokenAmount(repayAmount);
    if (amount <= BigInt(0)) return;

    await submitBlendTx("Repay", "repay", () =>
      buildBlendRepayXdr({
        pool: blendConfig.poolId,
        asset: blendConfig.usdcId,
        from: walletAddress,
        amount,
        network,
      }),
    );
  }

  // --- Login screen (not authenticated) ---
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-6 py-12 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/20">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v12m-6-6h12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Blend Borrow</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Borrow and repay USDC against your collateral on Blend, signed with
            your Pollar wallet. 100% client-side.
          </p>
          <button
            onClick={openLoginModal}
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 active:translate-y-0"
          >
            Connect with Pollar Wallet
          </button>
          <p className="mt-4 text-xs text-zinc-400">
            Contract-direct · no backend · signed with Pollar
          </p>
        </div>
      </div>
    );
  }

  const busy =
    txStatus.kind === "building" || txStatus.kind === "signing";
  const borrowBusy = busy && txStatus.action === "borrow";
  const repayBusy = busy && txStatus.action === "repay";
  const borrowSuccess =
    txStatus.kind === "success" && txStatus.action === "borrow"
      ? txStatus.hash
      : null;
  const repaySuccess =
    txStatus.kind === "success" && txStatus.action === "repay"
      ? txStatus.hash
      : null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-sm font-bold shadow-sm">
            P
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight">Pollar</span>
            <span className="text-zinc-400">×</span>
            <span className="text-base font-medium text-zinc-600">Blend</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Borrow
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-tint/60 px-3 py-2 font-mono text-xs font-semibold text-brand">
            {walletAddress
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
              : ""}
          </span>
          <button
            onClick={logout}
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Borrow &amp; Repay
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Blend lending pool · USDC
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Home
          </a>
        </div>

        {/* Position Dashboard */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Your Position
            </h2>
          </div>

          {positionError && (
            <div className="px-5 py-3 text-sm text-red-600">
              {positionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-px bg-zinc-100">
            {/* Collateral */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Collateral
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-zinc-900">
                  {position ? position.supplied : "…"}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  USDC
                </span>
              </div>
            </div>

            {/* Borrowed */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Borrowed
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-xl font-bold ${
                    position && Number(position.borrowed) > 0
                      ? "text-amber-600"
                      : "text-zinc-900"
                  }`}
                >
                  {position ? position.borrowed : "…"}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  USDC
                </span>
              </div>
            </div>

            {/* Borrow Capacity */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Borrow Limit
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-zinc-900">
                  {position
                    ? `${(position.borrowLimit * 100).toFixed(1)}%`
                    : "…"}
                </span>
              </div>
              {position && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400 transition-all"
                    style={{
                      width: `${Math.min(position.borrowLimit * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Available to borrow */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Available
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-emerald-600">
                  {position ? position.borrowCap : "…"}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  USDC
                </span>
              </div>
            </div>

            {/* Borrow APY */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Borrow APY
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-rose-500">
                  {position
                    ? `${(position.borrowApy * 100).toFixed(2)}%`
                    : "…"}
                </span>
              </div>
            </div>

            {/* Supply APY */}
            <div className="bg-white px-5 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Supply APY
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-emerald-500">
                  {position
                    ? `${(position.supplyApy * 100).toFixed(2)}%`
                    : "…"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* No collateral warning */}
        {!hasCollateral && !positionError && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">
                !
              </span>
              <div>
                <p className="font-medium">No collateral supplied</p>
                <p className="mt-1 text-amber-700/80">
                  You need to supply USDC as collateral first. Go to{" "}
                  <a
                    href="/blend-patrickkish"
                    className="font-semibold text-amber-900 underline hover:no-underline"
                  >
                    /blend-patrickkish
                  </a>{" "}
                  to lend USDC to the pool using Pollar&apos;s native Earn flow.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Borrow Form */}
        <form
          onSubmit={handleBorrow}
          className="mb-5 overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-sm"
        >
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Borrow USDC
              </h2>
              {position && canBorrow && (
                <button
                  type="button"
                  onClick={() =>
                    setBorrowAmount(availableToBorrow.toFixed(USDC_DECIMALS))
                  }
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Max: {availableToBorrow.toFixed(2)}
                </button>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="relative flex items-center">
              <input
                value={borrowAmount}
                onChange={(e) => {
                  setBorrowAmount(e.target.value);
                  if (
                    txStatus.kind === "success" &&
                    txStatus.action === "borrow"
                  )
                    setTxStatus({ kind: "idle" });
                }}
                inputMode="decimal"
                placeholder="0.00"
                className={inputClass}
                disabled={borrowBusy}
              />
              <span className="absolute right-4 text-sm font-semibold text-zinc-400">
                USDC
              </span>
            </div>

            {borrowSuccess && (
              <a
                href={getTxExplorerUrl(borrowSuccess, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs font-medium text-brand hover:underline"
              >
                View borrow tx on explorer →
              </a>
            )}

            {position && !hasCollateral && (
              <p className="mt-3 text-xs text-amber-700">
                Supply collateral first to enable borrowing.
              </p>
            )}

            <button
              type="submit"
              disabled={
                borrowBusy ||
                !verified ||
                !borrowAmount ||
                !canBorrow
              }
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-6 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110 active:translate-y-0 disabled:pointer-events-none disabled:opacity-40"
            >
              {borrowBusy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {txStatus.kind === "building" ? "Building tx…" : "Signing…"}
                </span>
              ) : !verified ? (
                "Verifying session…"
              ) : !borrowAmount ? (
                "Enter amount"
              ) : (
                `Borrow USDC`
              )}
            </button>
          </div>
        </form>

        {/* Repay Form */}
        <form
          onSubmit={handleRepay}
          className="mb-6 overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-sm"
        >
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Repay USDC
              </h2>
              {hasDebt && (
                <div className="flex gap-2">
                  {usdcBalance && Number(usdcBalance) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const maxRepay = Math.min(
                          Number(usdcBalance),
                          borrowed,
                        );
                        setRepayAmount(maxRepay.toFixed(USDC_DECIMALS));
                      }}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Wallet: {Number(usdcBalance).toFixed(2)}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="relative flex items-center">
              <input
                value={repayAmount}
                onChange={(e) => {
                  setRepayAmount(e.target.value);
                  if (
                    txStatus.kind === "success" &&
                    txStatus.action === "repay"
                  )
                    setTxStatus({ kind: "idle" });
                }}
                inputMode="decimal"
                placeholder="0.00"
                className={inputClass}
                disabled={repayBusy}
              />
              <span className="absolute right-4 text-sm font-semibold text-zinc-400">
                USDC
              </span>
            </div>

            {repaySuccess && (
              <a
                href={getTxExplorerUrl(repaySuccess, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs font-medium text-brand hover:underline"
              >
                View repay tx on explorer →
              </a>
            )}

            {!hasDebt && (
              <p className="mt-3 text-xs text-zinc-500">
                No outstanding debt to repay.
              </p>
            )}

            <button
              type="submit"
              disabled={
                repayBusy ||
                !verified ||
                !repayAmount ||
                !canRepay
              }
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border-2 border-brand bg-white px-6 text-sm font-semibold text-brand shadow-sm transition-all duration-200 hover:bg-brand-tint active:translate-y-0 disabled:pointer-events-none disabled:opacity-40"
            >
              {repayBusy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  {txStatus.kind === "building" ? "Building tx…" : "Signing…"}
                </span>
              ) : !verified ? (
                "Verifying session…"
              ) : !repayAmount ? (
                "Enter amount"
              ) : (
                `Repay USDC`
              )}
            </button>
          </div>
        </form>

        {/* Status Messages */}
        {txStatus.kind === "success" && (
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                ✓
              </span>
              {txStatus.label} successful!
            </div>
            <p className="break-all font-mono text-xs text-emerald-700/80">
              {txStatus.hash}
            </p>
            <button
              type="button"
              onClick={() => setTxStatus({ kind: "idle" })}
              className="mt-1 self-start text-xs font-medium text-emerald-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {txStatus.kind === "error" && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800">
            <div className="font-bold">Transaction failed</div>
            <div className="mt-1 text-xs">{txStatus.message}</div>
            <button
              type="button"
              onClick={() => setTxStatus({ kind: "idle" })}
              className="mt-2 text-xs font-medium text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {txStatus.kind !== "success" && txStatus.kind !== "error" && (
          <p className="text-center text-[11px] text-zinc-400">
            Contract-direct · no backend · signed with Pollar
          </p>
        )}
      </main>
    </div>
  );
}

