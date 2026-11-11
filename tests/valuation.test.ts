// Pilot tests for LO1 (docs/test-approach.md). Covers FR-1..FR-5, QR-2.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, valuePortfolio, type Settings } from "@/lib/valuation";
import type { Holding, PortfolioResponse } from "@/lib/types";

const ADDR = "0x0000000000000000000000000000000000000001";

function holding(over: Partial<Holding>): Holding {
  return {
    id: "h", chainKey: "ETHEREUM", chainName: "Ethereum", token: "native", symbol: "ETH", amount: 1,
    kind: "wallet", trusted: true, priceKey: "coingecko:ethereum", marketPrice: null, ...over,
  };
}

function portfolio(holdings: Holding[], ethPrice: number | null = 2000): PortfolioResponse {
  return {
    fetchedAt: "2026-01-01T00:00:00Z", ethPrice, assetPrices: {}, errors: [],
    addresses: [{ address: ADDR, label: "Test", holdings, healthFactors: [] }],
  };
}

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, manualBalances: {}, ...over });
const first = (h: Holding[], s = settings(), eth: number | null = 2000) =>
  valuePortfolio(portfolio(h, eth), s).addresses[0].holdings[0];

describe("FR-1 value = amount x price, debt negative", () => {
  it("values a wallet holding", () => {
    expect(first([holding({ symbol: "LINK", amount: 3, marketPrice: 10 })]).value).toBe(30);
  });
  it("makes debt negative", () => {
    expect(first([holding({ symbol: "LINK", amount: 3, marketPrice: 10, kind: "debt" })]).value).toBe(-30);
  });
});

describe("FR-2 price precedence", () => {
  it("prefers market over user default", () => {
    const s = settings({ defaultPrices: { k: { price: 5, symbol: "X", chainName: "c" } } });
    const h = first([holding({ symbol: "X", priceKey: "k", marketPrice: 9 })], s);
    expect([h.price, h.priceSource]).toEqual([9, "market"]);
  });
  it("uses user default when no market price", () => {
    const s = settings({ defaultPrices: { k: { price: 5, symbol: "X", chainName: "c" } } });
    expect(first([holding({ symbol: "X", priceKey: "k" })], s).priceSource).toBe("default");
  });
  it("falls back to ETH price for ETH derivatives", () => {
    const h = first([holding({ symbol: "wstETH" })]);
    expect([h.price, h.priceSource]).toEqual([2000, "eth"]);
  });
  it("pegs trusted stablecoins to 1", () => {
    const h = first([holding({ symbol: "USDC", amount: 50 })]);
    expect([h.price, h.priceSource, h.value]).toEqual([1, "peg", 50]);
  });
  it("gives value 0 and source none otherwise", () => {
    const h = first([holding({ symbol: "FOO", amount: 4 })]);
    expect([h.price, h.priceSource, h.value]).toEqual([null, "none", 0]);
  });
});

describe("FR-3 spam tokens", () => {
  it("does not count an untrusted WETH as ETH", () => {
    expect(first([holding({ symbol: "WETH", trusted: false })]).isEth).toBe(false);
  });
  it("does not peg or count an unpriced untrusted USDC as stable", () => {
    const h = first([holding({ symbol: "USDC", trusted: false, amount: 1e6 })]);
    expect([h.isStable, h.value]).toEqual([false, 0]);
  });
});

describe("FR-4 summary totals", () => {
  it("computes supplied, borrowed, stable and volatile", () => {
    const s = valuePortfolio(
      portfolio([
        holding({ id: "a", symbol: "USDC", amount: 100, kind: "supply" }),
        holding({ id: "b", symbol: "USDC", amount: 30, kind: "debt" }),
        holding({ id: "c", symbol: "ETH", amount: 1 }),
      ]),
      settings(),
    );
    expect(s.supplied).toBe(100);
    expect(s.borrowed).toBe(30);
    expect(s.totalStable).toBe(100); // borrowed stable not subtracted
    expect(s.total).toBe(100 - 30 + 2000);
    expect(s.totalVolatile).toBe(2000); // total 2070 minus net stable 70
  });
});

describe("FR-5 manual assets", () => {
  it("values BTC with market price and SOL with default", () => {
    const p = portfolio([]);
    p.assetPrices = { "coingecko:bitcoin": 100 };
    const s = settings({
      manualBalances: { BTC: 2 },
      defaultPrices: { "coingecko:solana": { price: 10, symbol: "SOL", chainName: "-" } },
    });
    const m = valuePortfolio(p, s).manualAssets;
    expect(m.find((a) => a.symbol === "BTC")).toMatchObject({ value: 200, priceSource: "market" });
    expect(m.find((a) => a.symbol === "SOL")).toMatchObject({ priceSource: "default" });
  });
});

describe("QR-2 valuation speed", () => {
  it("values 500 holdings in under 50 ms", () => {
    const hs = Array.from({ length: 500 }, (_, i) => holding({ id: String(i), symbol: "LINK", marketPrice: 10 }));
    const p = portfolio(hs);
    const t0 = performance.now();
    valuePortfolio(p, settings());
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
