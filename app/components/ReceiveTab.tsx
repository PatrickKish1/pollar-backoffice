"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { usePollar } from "@pollar/react";

export function ReceiveTab() {
  const { wallet } = usePollar();
  const walletAddress = wallet?.address ?? null;
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!walletAddress) {
    return (
      <p className="text-sm text-zinc-500">
        Tu wallet todavía se está creando. Vuelve en unos segundos.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="self-start text-lg font-semibold">Recibir dinero</h2>

      <p className="text-center text-sm text-zinc-500">
        Comparte tu dirección de Stellar o escanea el código QR para recibir un
        pago.
      </p>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <QRCodeSVG value={walletAddress} size={200} marginSize={2} />
      </div>

      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="break-all font-mono text-xs text-zinc-700">
          {walletAddress}
        </span>
        <span className="shrink-0 text-sm font-medium text-brand">
          {copied ? "¡Copiado!" : "Copiar"}
        </span>
      </button>
    </div>
  );
}
