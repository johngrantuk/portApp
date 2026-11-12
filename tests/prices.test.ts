// LO2 integration tests for src/lib/server/prices.ts with a mocked fetch. Covers FR-8.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPrices } from "@/lib/server/prices";

const ok = (coins: Record<string, { price: number }>) => ({ ok: true, status: 200, json: async () => ({ coins }) });

afterEach(() => vi.unstubAllGlobals());

describe("FR-8 chunking", () => {
  it("fetches 130 unique keys in 3 requests of at most 60 keys", async () => {
    const fetchMock = vi.fn(async () => ok({}));
    vi.stubGlobal("fetch", fetchMock);
    const keys = Array.from({ length: 130 }, (_, i) => `ethereum:0x${i.toString(16).padStart(40, "0")}`);
    await fetchPrices([...keys, ...keys.map((k) => k.toUpperCase())]); // duplicates in other case
    const sizes = (fetchMock.mock.calls as unknown as [string][]).map(([url]) => url.split("/").pop()!.split(",").length);
    expect(sizes.sort()).toEqual([10, 60, 60]);
  });

  it("makes no request for an empty key list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchPrices([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lower-cases keys and merges results from all chunks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ "Coingecko:Ethereum": { price: 2000 } })));
    const m = await fetchPrices(["coingecko:ethereum"]);
    expect(m.get("coingecko:ethereum")?.price).toBe(2000);
  });

  it("skips entries without a numeric price", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ a: { price: "x" as unknown as number }, b: { price: 1 } })));
    const m = await fetchPrices(["a", "b"]);
    expect([...m.keys()]).toEqual(["b"]);
  });

  it("rejects when DefiLlama answers with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(fetchPrices(["a"])).rejects.toThrow("failed: 429");
  });
});
