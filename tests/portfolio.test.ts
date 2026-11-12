// LO2 integration tests with test doubles. Covers FR-7, RR-3 (docs/test-plan.md).
// viem's createPublicClient, discovery and prices are replaced; no network is used.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chain } from "viem";

const USER = "0x0000000000000000000000000000000000000001";
const ASSET = "0x00000000000000000000000000000000000000a1"; // underlying (USDC-like)
const ATOKEN = "0x00000000000000000000000000000000000000a2";
const STABLE_DEBT = "0x00000000000000000000000000000000000000a3";
const VAR_DEBT = "0x00000000000000000000000000000000000000a4";
const CURATED = "0x00000000000000000000000000000000000000b1";
const ZERO = "0x0000000000000000000000000000000000000000";

type Behaviour = {
  nativeWei: bigint;
  balances: Record<string, bigint>; // token (lowercase) -> raw balance
  failMulticall?: boolean;
  failGetPool?: boolean;
  failNative?: boolean;
};
const behaviours = new Map<number, Behaviour>();

const cfg = (key: string, id: number, market = true) => ({
  key,
  name: key,
  chain: { id } as Chain,
  llamaChain: key.toLowerCase(),
  defaultRpcUrl: "http://rpc.invalid",
  native: { symbol: "ETH", llamaId: "coingecko:ethereum" },
  tokens: [CURATED, ATOKEN],
  lendingMarkets: market ? [{ name: "Mkt", addressesProvider: "0x00000000000000000000000000000000000000c1" }] : [],
});

const discoverTokens = vi.fn();
const fetchPrices = vi.fn();

vi.mock("@/lib/server/chains", () => ({
  CHAINS: [cfg("GOOD", 1), cfg("BAD", 2)],
  rpcUrlFor: () => "http://rpc.invalid",
}));
vi.mock("@/lib/server/discovery", () => ({ discoverTokens: (...a: unknown[]) => discoverTokens(...a) }));
vi.mock("@/lib/server/prices", () => ({ fetchPrices: (...a: unknown[]) => fetchPrices(...a) }));

vi.mock("viem", async (orig) => ({
  ...(await orig<typeof import("viem")>()),
  createPublicClient: ({ chain }: { chain: Chain }) => {
    const b = behaviours.get(chain.id)!;
    return {
      getBalance: async () => {
        if (b.failNative) throw new Error("native rpc down");
        return b.nativeWei;
      },
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "getPool") {
          if (b.failGetPool) throw new Error("pool lookup failed");
          return "0x00000000000000000000000000000000000000d1";
        }
        if (functionName === "getPoolDataProvider") return "0x00000000000000000000000000000000000000d2";
        if (functionName === "getAllReservesTokens") return [{ symbol: "USDC", tokenAddress: ASSET }];
        throw new Error(`unexpected readContract ${functionName}`);
      },
      multicall: async ({ contracts, allowFailure }: { contracts: { address: string; functionName: string; args?: string[] }[]; allowFailure?: boolean }) => {
        if (b.failMulticall) throw new Error("multicall rejected");
        return contracts.map((c) => {
          // viem returns bare values when allowFailure is false, {status, result} otherwise.
          const ok = (result: unknown) => (allowFailure === false ? result : { status: "success", result });
          switch (c.functionName) {
            case "decimals": return ok(6);
            case "symbol": return ok("TKN");
            case "getReserveTokensAddresses": return ok([ATOKEN, STABLE_DEBT, VAR_DEBT]);
            case "balanceOf": return ok(b.balances[c.address.toLowerCase()] ?? BigInt(0));
            default: return { status: "failure", error: new Error(c.functionName) };
          }
        });
      },
    };
  },
}));

async function load() {
  vi.resetModules(); // module-level caches in portfolio.ts must not leak between tests
  return (await import("@/lib/server/portfolio")).getPortfolio;
}

beforeEach(() => {
  process.env.PORTFOLIO_ADDRESSES = `${USER}:Test`;
  behaviours.set(1, {
    nativeWei: BigInt(10) ** BigInt(18),
    balances: {
      [ATOKEN]: BigInt(100_000_000), // 100 supplied
      [STABLE_DEBT]: BigInt(5_000_000), // 5 stable debt
      [VAR_DEBT]: BigInt(20_000_000), // 20 variable debt
      [CURATED]: BigInt(7_000_000), // 7 wallet tokens
    },
  });
  behaviours.set(2, { nativeWei: BigInt(0), balances: {} });
  discoverTokens.mockResolvedValue([]);
  fetchPrices.mockResolvedValue(new Map([["coingecko:ethereum", { price: 2000 }]]));
});
afterEach(() => {
  delete process.env.PORTFOLIO_ADDRESSES;
  vi.clearAllMocks();
});

const holdingsOf = (r: Awaited<ReturnType<Awaited<ReturnType<typeof load>>>>) => r.addresses[0].holdings;

describe("FR-7 lending positions", () => {
  it("merges stable and variable debt of one reserve into a single holding", async () => {
    const r = await (await load())();
    const debts = holdingsOf(r).filter((h) => h.kind === "debt" && h.chainKey === "GOOD");
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({ symbol: "USDC", amount: 25, market: "Mkt" });
  });

  it("reports aTokens as supply and not as a wallet balance", async () => {
    const r = await (await load())();
    const good = holdingsOf(r).filter((h) => h.chainKey === "GOOD");
    expect(good.filter((h) => h.kind === "supply")).toMatchObject([{ symbol: "USDC", amount: 100 }]);
    // ATOKEN is in the curated list but must not also appear as wallet holding.
    expect(good.filter((h) => h.kind === "wallet" && h.token === ATOKEN)).toHaveLength(0);
    expect(good.filter((h) => h.kind === "wallet" && h.token === CURATED)).toHaveLength(1);
  });
});

describe("RR-3 partial failure", () => {
  it("keeps results from a healthy chain when another chain's RPC fails", async () => {
    behaviours.get(2)!.failMulticall = true;
    const r = await (await load())();
    expect(r.errors.some((e) => e.startsWith("BAD"))).toBe(true);
    expect(holdingsOf(r).some((h) => h.chainKey === "GOOD" && h.kind === "supply")).toBe(true);
  });

  it("reports a failing price request and still returns holdings", async () => {
    fetchPrices.mockRejectedValue(new Error("DefiLlama prices request failed: 500"));
    const r = await (await load())();
    expect(r.errors).toContain("Prices: DefiLlama prices request failed: 500");
    expect(r.ethPrice).toBeNull();
    expect(holdingsOf(r).length).toBeGreaterThan(0);
  });

  it("reports a failing token discovery call and still returns holdings", async () => {
    discoverTokens.mockRejectedValue(new Error("Blockscout 502"));
    const r = await (await load())();
    expect(r.errors.some((e) => e.includes("token discovery: Blockscout 502"))).toBe(true);
    expect(holdingsOf(r).some((h) => h.kind === "supply")).toBe(true);
  });

  it("reports a failing lending market lookup and still returns wallet holdings", async () => {
    behaviours.get(1)!.failGetPool = true;
    const r = await (await load())();
    expect(r.errors.some((e) => e.includes("GOOD Mkt: pool lookup failed"))).toBe(true);
    expect(holdingsOf(r).some((h) => h.kind === "wallet" && h.token === CURATED)).toBe(true);
  });

  it("reports a failing native balance call and still returns token holdings", async () => {
    behaviours.get(1)!.failNative = true;
    const r = await (await load())();
    expect(r.errors.some((e) => e.includes("native balance: native rpc down"))).toBe(true);
    expect(holdingsOf(r).some((h) => h.kind === "supply")).toBe(true);
  });
});

describe("FR-8 price attachment", () => {
  it("attaches market prices from the price map to holdings and eth price", async () => {
    fetchPrices.mockResolvedValue(
      new Map([
        ["coingecko:ethereum", { price: 2000 }],
        ["good:" + ASSET, { price: 1.01 }],
      ]),
    );
    const r = await (await load())();
    expect(r.ethPrice).toBe(2000);
    expect(holdingsOf(r).find((h) => h.kind === "supply")!.marketPrice).toBe(1.01);
  });

  it("ignores low-confidence prices for untrusted tokens only", async () => {
    discoverTokens.mockResolvedValue(["0x00000000000000000000000000000000000000e1"]);
    behaviours.get(1)!.balances["0x00000000000000000000000000000000000000e1"] = BigInt(1_000_000);
    fetchPrices.mockResolvedValue(
      new Map([
        ["good:0x00000000000000000000000000000000000000e1", { price: 99, confidence: 0.1 }],
        ["good:" + CURATED, { price: 3, confidence: 0.1 }],
      ]),
    );
    const r = await (await load())();
    const h = holdingsOf(r);
    expect(h.find((x) => x.token === "0x00000000000000000000000000000000000000e1")!.marketPrice).toBeNull();
    expect(h.find((x) => x.token === CURATED)!.marketPrice).toBe(3);
  });
});

void ZERO;
