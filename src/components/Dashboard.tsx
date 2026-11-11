"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatAmount, formatPrice, formatUsd, timeAgo } from "@/lib/format";
import type { PortfolioResponse } from "@/lib/types";
import { useHydrated, useLocalStorage } from "@/lib/useLocalStorage";
import { DEFAULT_SETTINGS, valuePortfolio, type Settings } from "@/lib/valuation";
import { AddressCard } from "./AddressCard";
import { ManualAssetCard } from "./ManualAssetCard";
import { SettingsSheet } from "./SettingsSheet";

const SNAPSHOT_KEY = "portfolio.snapshot.v1";
const SETTINGS_KEY = "portfolio.settings.v1";

export function Dashboard() {
  const hydrated = useHydrated();
  const [snapshot, setSnapshot] = useLocalStorage<PortfolioResponse | null>(SNAPSHOT_KEY, null);
  const [storedSettings, setSettings] = useLocalStorage<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const settings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      manualBalances: { ...DEFAULT_SETTINGS.manualBalances, ...storedSettings.manualBalances },
    }),
    [storedSettings],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const now = useNow();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setSnapshot(json as PortfolioResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setSnapshot]);

  // Fetch automatically only on the first visit; afterwards the cached snapshot is shown until Refresh.
  const autoFetched = useRef(false);
  useEffect(() => {
    if (!hydrated || snapshot || autoFetched.current) return;
    autoFetched.current = true;
    void refresh();
  }, [hydrated, snapshot, refresh]);

  const summary = useMemo(() => (snapshot ? valuePortfolio(snapshot, settings) : null), [snapshot, settings]);
  const missingPrices = useMemo(
    () =>
      new Set(
        summary?.addresses.flatMap((a) =>
          a.holdings.filter((h) => h.trusted && h.priceSource === "none").map((h) => h.priceKey),
        ),
      ).size,
    [summary],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-white/5 bg-zinc-950/85 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
          <p className="truncate text-xs text-zinc-500">
            {loading ? "Refreshing…" : snapshot ? `Updated ${timeAgo(snapshot.fetchedAt, now)}` : "No data yet"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            aria-label="Settings"
          >
            Settings
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            <RefreshIcon spinning={loading} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {!summary && hydrated && !error && (
        <div className="mt-16 text-center text-sm text-zinc-500">Loading portfolio… this can take a few seconds.</div>
      )}

      {summary && snapshot && (
        <>
          <section className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-zinc-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Net worth</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{formatUsd(summary.total, { whole: true })}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Stat label="Volatile crypto" value={formatUsd(summary.totalVolatile, { whole: true })} />
              <Stat label="Stablecoins" value={formatUsd(summary.totalStable, { whole: true })} />
              <Stat label="Total ETH" value={`Ξ ${formatAmount(summary.totalEth)}`} />
              <Stat label="ETH price" value={summary.ethPrice ? formatPrice(summary.ethPrice) : "—"} />
              <Stat label="Supplied" value={formatUsd(summary.supplied, { whole: true })} />
              <Stat label="Borrowed" value={formatUsd(summary.borrowed, { whole: true })} negative={summary.borrowed > 0} />
            </div>
          </section>

          {missingPrices > 0 && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm text-amber-200"
            >
              {missingPrices} token{missingPrices > 1 ? "s have" : " has"} no price feed and no default price. Tap to set one.
            </button>
          )}

          {snapshot.errors.length > 0 && (
            <details className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <summary className="cursor-pointer">Some data could not be loaded ({snapshot.errors.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {snapshot.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 space-y-3">
            {summary.manualAssets.map((asset) => (
              <ManualAssetCard
                key={asset.symbol}
                asset={asset}
                onBalanceChange={(balance) =>
                  setSettings((prev) => ({
                    ...prev,
                    manualBalances: { ...prev.manualBalances, [asset.symbol]: balance },
                  }))
                }
                onMissingPrice={() => setSettingsOpen(true)}
              />
            ))}
            {summary.addresses.map((a) => (
              <AddressCard key={a.address} data={a} hideSmallBalances={settings.hideSmallBalances} />
            ))}
          </div>
        </>
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={setSettings}
          summary={summary}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`font-medium tabular-nums ${negative ? "text-red-300" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

let clock = 0;

function subscribeClock(onChange: () => void) {
  const tick = () => {
    clock = Date.now();
    onChange();
  };
  tick();
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
}

function useNow() {
  return useSyncExternalStore(subscribeClock, () => clock, () => 0);
}
