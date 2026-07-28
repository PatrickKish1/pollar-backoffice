"use client";

import { useState } from "react";
import Image from "next/image";
import { usePollar } from "@pollar/react";
import { BalanceTab } from "./BalanceTab";
import { SendTab } from "./SendTab";
import { ReceiveTab } from "./ReceiveTab";

type TabId = "balance" | "send" | "receive";

// Order: balance first (the home view), then the two money actions. Receive
// closes the set since it is the most "passive" action (just share an address).
const TABS: { id: TabId; label: string }[] = [
  { id: "balance", label: "Saldo" },
  { id: "send", label: "Enviar" },
  { id: "receive", label: "Recibir" },
];

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletDashboard() {
  const { wallet, logout } = usePollar();
  const walletAddress = wallet?.address ?? null;
  const [active, setActive] = useState<TabId>("balance");
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Top navigation bar, mirroring the Pollar demo layout. */}
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3.5">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Pollar"
            width={32}
            height={32}
            priority
            className="h-7 w-7 object-contain"
          />
          <span className="text-base font-semibold tracking-tight">Pollar</span>
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Wallet
          </span>
        </div>

        <div className="flex items-center gap-2">
          {walletAddress && (
            <button
              type="button"
              onClick={copyAddress}
              title="Copiar dirección"
              className="rounded-lg bg-brand px-3 py-1.5 font-mono text-xs font-medium text-white transition-colors hover:bg-brand-dark"
            >
              {copied ? "¡Copiado!" : shortenAddress(walletAddress)}
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Tu <span className="text-brand">wallet</span>
        </h1>

        <nav
          role="tablist"
          aria-label="Acciones de la wallet"
          className="flex gap-1 rounded-xl bg-zinc-100 p-1"
        >
          {TABS.map((tab) => {
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-white text-brand shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section
          id={`panel-${active}`}
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          {active === "balance" && <BalanceTab />}
          {active === "send" && <SendTab onSent={() => setActive("balance")} />}
          {active === "receive" && <ReceiveTab />}
        </section>
      </main>
    </div>
  );
}
