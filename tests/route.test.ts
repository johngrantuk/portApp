// LO2 system-level (route) tests with the server module mocked. Covers FR-9 and the 500 path.
import { describe, expect, it, vi } from "vitest";

const getPortfolio = vi.fn();
vi.mock("@/lib/server/portfolio", () => ({ getPortfolio: () => getPortfolio() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), connection: async () => {} }));

import { GET, maxDuration } from "@/app/api/portfolio/route";

describe("FR-9 GET /api/portfolio", () => {
  it("returns the PortfolioResponse JSON with cache-control: no-store", async () => {
    const body = { fetchedAt: "2026-01-01T00:00:00Z", ethPrice: 2000, assetPrices: {}, addresses: [], errors: [] };
    getPortfolio.mockResolvedValue(body);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(body);
  });
  it("returns 500 with the error message when loading throws", async () => {
    getPortfolio.mockRejectedValue(new Error("Invalid address in PORTFOLIO_ADDRESSES: 0xnothex"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Invalid address in PORTFOLIO_ADDRESSES: 0xnothex" });
  });
});

describe("QR-1 route time limit", () => {
  it("declares maxDuration of 60 s", () => {
    expect(maxDuration).toBe(60);
  });
});
