"use client";

import { useState } from "react";
import { formatAmount, formatPrice, formatUsd, shortAddress } from "@/lib/format";
import { SMALL_BALANCE_USD, type ValuedAddress, type ValuedHolding } from "@/lib/valuation";

export function AddressCard({ data, hideSmallBalances }: { data: ValuedAddress; hideSmallBalances: boolean }) {
  const [open, setOpen] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHidden = (h: ValuedHolding) =>
    (!h.trusted && h.priceSource === "none") || (hideSmallBalances && Math.abs(h.value) < SMALL_BALANCE_USD);
  const hiddenCount = data.holdings.filter(isHidden).length;
  const visible = showHidden ? data.holdings : data.holdings.filter((h) => !isHidden(h));

  const groups = new Map<string, ValuedHolding[]>();
  for (const h of visible) {
    const key = h.kind === "wallet" ? "Wallet" : `${h.market} · ${h.chainName}`;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }

  const copy = async () => {
    await navigator.clipboard.writeText(data.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium">{data.label}</p>
          <p className="font-mono text-xs text-zinc-500">{shortAddress(data.address)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">{formatUsd(data.total, { whole: true })}</p>
          <p className="text-xs tabular-nums text-zinc-400">Ξ {formatAmount(data.totalEth)}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2 pt-3 text-xs">
            <button onClick={copy} className="rounded-md border border-white/10 px-2 py-1 text-zinc-400 hover:bg-white/5">
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              href={`https://debank.com/profile/${data.address}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/10 px-2 py-1 text-zinc-400 hover:bg-white/5"
            >
              DeBank ↗
            </a>
            {data.healthFactors.map((hf) => (
              <span
                key={`${hf.chainName}-${hf.market}`}
                className={`rounded-md px-2 py-1 ${hf.healthFactor < 1.5 ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}
              >
                {hf.market} HF {hf.healthFactor.toFixed(2)}
              </span>
            ))}
          </div>

          {[...groups.entries()].map(([group, holdings]) => (
            <div key={group} className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
                <span>{group}</span>
                <span className="tabular-nums">{formatUsd(holdings.reduce((s, h) => s + h.value, 0), { whole: true })}</span>
              </div>
              <ul className="divide-y divide-white/5">
                {holdings.map((h) => (
                  <HoldingRow key={h.id} h={h} />
                ))}
              </ul>
            </div>
          ))}

          {visible.length === 0 && <p className="pt-4 text-sm text-zinc-500">No balances.</p>}

          {hiddenCount > 0 && (
            <button onClick={() => setShowHidden((s) => !s)} className="mt-3 text-xs text-zinc-500 underline-offset-2 hover:underline">
              {showHidden ? "Hide" : "Show"} {hiddenCount} small or unpriced balance{hiddenCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const SOURCE_LABEL: Record<ValuedHolding["priceSource"], string | null> = {
  market: null,
  default: "default price",
  eth: "ETH price",
  peg: "$1 peg",
  none: "no price",
};

function HoldingRow({ h }: { h: ValuedHolding }) {
  const sourceLabel = SOURCE_LABEL[h.priceSource];
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{h.symbol}</span>
          {h.kind === "supply" && <Badge className="bg-emerald-500/15 text-emerald-300">supplied</Badge>}
          {h.kind === "debt" && <Badge className="bg-red-500/15 text-red-300">borrowed</Badge>}
          {h.kind === "wallet" && <Badge className="bg-white/5 text-zinc-400">{h.chainName}</Badge>}
        </div>
        <p className="truncate text-xs tabular-nums text-zinc-500">
          {formatAmount(h.amount)} × {h.price !== null ? formatPrice(h.price) : "?"}
          {sourceLabel && (
            <span className={h.priceSource === "none" ? " text-red-400" : " text-amber-400"}> · {sourceLabel}</span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`tabular-nums ${h.value < 0 ? "text-red-300" : ""}`}>{formatUsd(h.value)}</p>
        {h.isEth && <p className="text-xs tabular-nums text-zinc-500">Ξ {formatAmount(h.ethAmount)}</p>}
      </div>
    </li>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${className}`}>{children}</span>;
}
