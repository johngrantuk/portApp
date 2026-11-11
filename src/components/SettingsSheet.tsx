"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import {
  DEFAULT_ETH_DERIVATIVES,
  DEFAULT_STABLECOINS,
  type Settings,
  type Summary,
} from "@/lib/valuation";

type TokenRow = {
  priceKey: string;
  symbol: string;
  chainName: string;
  marketPrice: number | null;
  trusted: boolean;
};

type Props = {
  settings: Settings;
  onChange: (update: (prev: Settings) => Settings) => void;
  summary: Summary | null;
  onClose: () => void;
};

export function SettingsSheet({ settings, onChange, summary, onClose }: Props) {
  const [showUntrusted, setShowUntrusted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const tokens = useMemo(() => {
    const rows = new Map<string, TokenRow>();
    for (const h of summary?.addresses.flatMap((a) => a.holdings) ?? []) {
      const existing = rows.get(h.priceKey);
      rows.set(h.priceKey, {
        priceKey: h.priceKey,
        symbol: h.symbol,
        chainName: h.chainName,
        marketPrice: h.marketPrice,
        trusted: h.trusted || (existing?.trusted ?? false),
      });
    }
    for (const asset of summary?.manualAssets ?? []) {
      rows.set(asset.priceKey, {
        priceKey: asset.priceKey,
        symbol: asset.symbol,
        chainName: asset.name,
        marketPrice: asset.priceSource === "market" ? asset.price : null,
        trusted: true,
      });
    }
    for (const [priceKey, d] of Object.entries(settings.defaultPrices)) {
      if (!rows.has(priceKey)) rows.set(priceKey, { priceKey, symbol: d.symbol, chainName: d.chainName, marketPrice: null, trusted: true });
    }
    return [...rows.values()].sort(
      (a, b) =>
        Number(a.marketPrice !== null) - Number(b.marketPrice !== null) ||
        a.symbol.localeCompare(b.symbol),
    );
  }, [summary, settings.defaultPrices]);

  const isUntrustedUnpriced = (t: TokenRow) => !t.trusted && t.marketPrice === null && !settings.defaultPrices[t.priceKey];
  const untrustedCount = tokens.filter(isUntrustedUnpriced).length;
  const visibleTokens = showUntrusted ? tokens : tokens.filter((t) => !isUntrustedUnpriced(t));

  const setDefaultPrice = (t: TokenRow, price: number | null) =>
    onChange((prev) => {
      const defaultPrices = { ...prev.defaultPrices };
      if (price === null) delete defaultPrices[t.priceKey];
      else defaultPrices[t.priceKey] = { price, symbol: t.symbol, chainName: t.chainName };
      return { ...prev, defaultPrices };
    });

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-zinc-950 sm:border-l sm:border-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5">
            Done
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 py-5">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Hide balances under $1</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-indigo-500"
              checked={settings.hideSmallBalances}
              onChange={(e) => onChange((prev) => ({ ...prev, hideSmallBalances: e.target.checked }))}
            />
          </label>

          <SymbolListEditor
            title="ETH derivatives"
            description="Token symbols counted towards the ETH total. Wrapped tokens count by value, e.g. 1 wstETH ≈ 1.2 ETH. Tokens without a price feed fall back to the ETH price. Borrowed ETH is not subtracted."
            placeholder="Add symbol, e.g. pufETH"
            symbols={settings.ethDerivatives}
            defaults={DEFAULT_ETH_DERIVATIVES}
            onChange={(ethDerivatives) => onChange((prev) => ({ ...prev, ethDerivatives }))}
          />

          <SymbolListEditor
            title="Stablecoins"
            description="Token symbols counted towards the stablecoin total, by USD value. Borrowed stablecoins are not subtracted. Known tokens without a price feed fall back to $1."
            placeholder="Add symbol, e.g. USDM"
            symbols={settings.stablecoins}
            defaults={DEFAULT_STABLECOINS}
            onChange={(stablecoins) => onChange((prev) => ({ ...prev, stablecoins }))}
          />

          <section>
            <h3 className="font-medium">Default prices</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Used when DefiLlama has no price for a token. Leave empty to clear. Lending positions use the underlying
              token&apos;s price.
            </p>
            <ul className="mt-3 divide-y divide-white/5">
              {visibleTokens.map((t) => (
                <li key={t.priceKey} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">
                      {t.symbol} <span className="text-xs font-normal text-zinc-500">{t.chainName}</span>
                    </p>
                    <p className={`text-xs ${t.marketPrice === null ? "text-amber-400" : "text-zinc-500"}`}>
                      {t.marketPrice === null ? "No price feed" : `Market ${formatPrice(t.marketPrice)}`}
                    </p>
                  </div>
                  <PriceInput value={settings.defaultPrices[t.priceKey]?.price} onCommit={(p) => setDefaultPrice(t, p)} />
                </li>
              ))}
            </ul>
            {tokens.length === 0 && <p className="mt-3 text-sm text-zinc-500">Load the portfolio first.</p>}
            {untrustedCount > 0 && (
              <button onClick={() => setShowUntrusted((s) => !s)} className="mt-3 text-xs text-zinc-500 hover:underline">
                {showUntrusted ? "Hide" : "Show"} {untrustedCount} unpriced discovered token{untrustedCount > 1 ? "s" : ""} (often
                airdropped spam)
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PriceInput({ value, onCommit }: { value: number | undefined; onCommit: (price: number | null) => void }) {
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return value !== undefined && onCommit(null);
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) onCommit(parsed);
  };
  return (
    <div className="relative w-32 shrink-0">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
      <input
        key={value ?? "empty"}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="—"
        defaultValue={value ?? ""}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full rounded-lg border border-white/10 bg-zinc-900 py-1.5 pl-6 pr-2 text-right text-sm tabular-nums outline-none focus:border-indigo-500"
      />
    </div>
  );
}

type SymbolListEditorProps = {
  title: string;
  description: string;
  placeholder: string;
  symbols: string[];
  defaults: string[];
  onChange: (next: string[]) => void;
};

function SymbolListEditor({ title, description, placeholder, symbols, defaults, onChange }: SymbolListEditorProps) {
  const [input, setInput] = useState("");

  const add = () => {
    const added = input
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !symbols.some((d) => d.toLowerCase() === s.toLowerCase()));
    if (added.length) onChange([...symbols, ...added]);
    setInput("");
  };

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <button onClick={() => onChange(defaults)} className="text-xs text-zinc-500 hover:underline">
          Reset to defaults
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {symbols.map((d) => (
          <span key={d} className="flex items-center gap-1 rounded-full bg-white/5 py-1 pl-3 pr-1 text-sm">
            {d}
            <button
              onClick={() => onChange(symbols.filter((x) => x !== d))}
              className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
              aria-label={`Remove ${d}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <button type="submit" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
          Add
        </button>
      </form>
    </section>
  );
}
