"use client";

import { formatPrice, formatUsd } from "@/lib/format";
import type { ValuedManualAsset } from "@/lib/valuation";

type Props = {
  asset: ValuedManualAsset;
  onBalanceChange: (balance: number) => void;
  onMissingPrice: () => void;
};

export function ManualAssetCard({ asset, onBalanceChange, onMissingPrice }: Props) {
  const commit = (raw: string) => {
    const parsed = Number(raw.trim() || 0);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== asset.balance) onBalanceChange(parsed);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{asset.name}</p>
          <p className="text-xs text-zinc-500">Manually entered balance</p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums">{formatUsd(asset.value, { whole: true })}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="relative w-40">
          <span className="sr-only">{asset.symbol} balance</span>
          <input
            key={asset.balance}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            defaultValue={asset.balance}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 py-1.5 pl-3 pr-12 text-right text-sm tabular-nums outline-none focus:border-indigo-500"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            {asset.symbol}
          </span>
        </label>
        <p className="text-right text-xs tabular-nums text-zinc-500">
          {asset.price !== null ? `× ${formatPrice(asset.price)}` : "× ?"}
          {asset.priceSource === "default" && <span className="text-amber-400"> · default price</span>}
          {asset.priceSource === "none" && (
            <button onClick={onMissingPrice} className="text-red-400 underline-offset-2 hover:underline">
              {" "}
              · no price, set one
            </button>
          )}
        </p>
      </div>
    </section>
  );
}
