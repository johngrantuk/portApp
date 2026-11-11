import "server-only";
import { createPublicClient, erc20Abi, formatUnits, http, parseAbi, zeroAddress, type Address, type PublicClient } from "viem";
import type { AddressPortfolio, HealthFactor, Holding, HoldingKind, PortfolioResponse } from "@/lib/types";
import { MANUAL_ASSETS } from "@/lib/valuation";
import { getTrackedAddresses } from "./addresses";
import { CHAINS, rpcUrlFor, type ChainConfig, type LendingMarket } from "./chains";
import { discoverTokens } from "./discovery";
import { fetchPrices } from "./prices";

const ETH_PRICE_KEY = "coingecko:ethereum";
// Public RPCs (e.g. publicnode Polygon) reject larger multicall payloads.
const MULTICALL_BATCH_BYTES = 8_192;
const METADATA_TTL_MS = 60 * 60 * 1000;
const MIN_CONFIDENCE_UNTRUSTED = 0.5;

const addressesProviderAbi = parseAbi([
  "function getPool() view returns (address)",
  "function getPoolDataProvider() view returns (address)",
]);
const dataProviderAbi = parseAbi([
  "function getAllReservesTokens() view returns ((string symbol, address tokenAddress)[])",
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
]);
const poolAbi = parseAbi([
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

type TokenMeta = { symbol: string; decimals: number };
type ReserveMeta = { asset: Address; symbol: string; decimals: number; aToken: Address; debtTokens: Address[] };
type MarketMeta = { market: LendingMarket; pool: Address; reserves: ReserveMeta[] };
type UserHolding = Holding & { user: Address };

// Module-level caches survive between requests on a warm serverless instance.
const tokenMetaCache = new Map<string, TokenMeta | null>();
const marketMetaCache = new Map<string, { at: number; meta: MarketMeta }>();

const errorMessage = (e: unknown) => (e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e));

export async function getPortfolio(): Promise<PortfolioResponse> {
  const tracked = getTrackedAddresses();
  const users = tracked.map((t) => t.address);
  const errors: string[] = [];

  const chainResults = await Promise.all(
    CHAINS.map(async (cfg) => {
      try {
        const result = await loadChain(cfg, users);
        errors.push(...result.errors);
        return result;
      } catch (e) {
        errors.push(`${cfg.name}: ${errorMessage(e)}`);
        return { holdings: [], healthFactors: [], errors: [] };
      }
    }),
  );

  const holdings = chainResults.flatMap((r) => r.holdings);
  const healthFactors = chainResults.flatMap((r) => r.healthFactors);

  let ethPrice: number | null = null;
  const manualKeys = MANUAL_ASSETS.map((a) => a.priceKey);
  const assetPrices: Record<string, number | null> = Object.fromEntries(manualKeys.map((k) => [k, null]));
  try {
    const prices = await fetchPrices([ETH_PRICE_KEY, ...manualKeys, ...holdings.map((h) => h.priceKey)]);
    ethPrice = prices.get(ETH_PRICE_KEY)?.price ?? null;
    for (const k of manualKeys) assetPrices[k] = prices.get(k)?.price ?? null;
    for (const h of holdings) {
      const p = prices.get(h.priceKey);
      if (!p) continue;
      const lowConfidence = p.confidence !== undefined && p.confidence < MIN_CONFIDENCE_UNTRUSTED;
      if (h.trusted || !lowConfidence) h.marketPrice = p.price;
    }
  } catch (e) {
    errors.push(`Prices: ${errorMessage(e)}`);
  }

  const addresses: AddressPortfolio[] = tracked.map(({ address, label }) => ({
    address,
    label,
    holdings: holdings.filter((h) => h.user === address).map(omitUser),
    healthFactors: healthFactors.filter((h) => h.user === address).map(omitUser),
  }));

  return { fetchedAt: new Date().toISOString(), ethPrice, assetPrices, addresses, errors };
}

function omitUser<T extends { user: Address }>(item: T): Omit<T, "user"> {
  const copy: Partial<T> = { ...item };
  delete copy.user;
  return copy as Omit<T, "user">;
}

async function loadChain(cfg: ChainConfig, users: Address[]) {
  const client = createPublicClient({
    chain: cfg.chain,
    transport: http(rpcUrlFor(cfg), { timeout: 20_000, retryCount: 2 }),
  }) as PublicClient;
  const errors: string[] = [];
  const holdings: UserHolding[] = [];
  const healthFactors: (HealthFactor & { user: Address })[] = [];

  const [markets, discovered] = await Promise.all([
    Promise.all(
      cfg.lendingMarkets.map((m) =>
        getMarketMeta(client, cfg, m).catch((e) => {
          errors.push(`${cfg.name} ${m.name}: ${errorMessage(e)}`);
          return null;
        }),
      ),
    ).then((ms) => ms.filter((m): m is MarketMeta => m !== null)),
    Promise.all(
      users.map((u) =>
        discoverTokens(cfg, u).catch((e) => {
          errors.push(`${cfg.name} token discovery: ${errorMessage(e)}`);
          return [] as Address[];
        }),
      ),
    ).then((lists) => lists.flat()),
  ]);

  // Aave aTokens/debt tokens are reported as lending positions, not wallet balances.
  const positionTokens = new Set(
    markets.flatMap((m) => m.reserves.flatMap((r) => [r.aToken, ...r.debtTokens])).map((a) => a.toLowerCase()),
  );
  const curated = new Set(cfg.tokens.map((t) => t.toLowerCase()));
  const walletTokens = [...new Set([...curated, ...discovered.map((t) => t.toLowerCase())])].filter(
    (t) => !positionTokens.has(t),
  ) as Address[];

  const tokenMeta = await getTokenMeta(client, cfg, walletTokens);

  const priceKey = (token: string) => `${cfg.llamaChain}:${token.toLowerCase()}`;
  const push = (h: Omit<UserHolding, "id" | "chainKey" | "chainName" | "marketPrice">) =>
    holdings.push({
      ...h,
      id: [cfg.key, h.user, h.token, h.kind, h.market ?? ""].join(":").toLowerCase(),
      chainKey: cfg.key,
      chainName: cfg.name,
      marketPrice: null,
    });

  // Native balances
  const nativeBalances = await Promise.all(
    users.map((u) =>
      client.getBalance({ address: u }).catch((e) => {
        errors.push(`${cfg.name} native balance: ${errorMessage(e)}`);
        return BigInt(0);
      }),
    ),
  );
  users.forEach((user, i) => {
    if (nativeBalances[i] > BigInt(0)) {
      push({
        user,
        token: "native",
        symbol: cfg.native.symbol,
        amount: Number(formatUnits(nativeBalances[i], 18)),
        kind: "wallet",
        trusted: true,
        priceKey: cfg.native.llamaId,
      });
    }
  });

  // Every ERC-20 balance (wallet tokens + lending position tokens) in one multicall.
  type BalanceCall = {
    user: Address;
    token: Address;
    symbol: string;
    decimals: number;
    kind: HoldingKind;
    market?: string;
    underlying: Address;
    trusted: boolean;
  };
  const calls: BalanceCall[] = [];
  for (const user of users) {
    for (const token of walletTokens) {
      const meta = tokenMeta.get(token);
      if (!meta) continue;
      calls.push({ user, token, ...meta, kind: "wallet", underlying: token, trusted: curated.has(token) });
    }
    for (const m of markets) {
      for (const r of m.reserves) {
        const base = { user, symbol: r.symbol, decimals: r.decimals, market: m.market.name, underlying: r.asset, trusted: true };
        calls.push({ ...base, token: r.aToken, kind: "supply" });
        for (const debt of r.debtTokens) calls.push({ ...base, token: debt, kind: "debt" });
      }
    }
  }

  const balances = await client.multicall({
    contracts: calls.map((c) => ({ address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [c.user] }) as const),
    allowFailure: true,
    batchSize: MULTICALL_BATCH_BYTES,
  });

  const failed = balances.filter((b, i) => b.status === "failure" && calls[i].trusted).length;
  if (failed > 0) errors.push(`${cfg.name}: ${failed} balance calls failed`);

  // Merge stable + variable debt for the same reserve.
  const merged = new Map<string, { call: BalanceCall; raw: bigint }>();
  balances.forEach((b, i) => {
    if (b.status !== "success" || (b.result as bigint) === BigInt(0)) return;
    const c = calls[i];
    const key = [c.user, c.underlying, c.kind, c.market ?? ""].join(":");
    const existing = merged.get(key);
    merged.set(key, { call: c, raw: (existing?.raw ?? BigInt(0)) + (b.result as bigint) });
  });

  for (const { call: c, raw } of merged.values()) {
    push({
      user: c.user,
      token: c.underlying.toLowerCase(),
      symbol: c.symbol,
      amount: Number(formatUnits(raw, c.decimals)),
      kind: c.kind,
      market: c.market,
      trusted: c.trusted,
      priceKey: priceKey(c.underlying),
    });
  }

  // Health factors for markets where the user has debt.
  const debtPairs = [
    ...new Set(holdings.filter((h) => h.kind === "debt").map((h) => `${h.user}|${h.market}`)),
  ].map((k) => {
    const [user, marketName] = k.split("|");
    return { user: user as Address, market: markets.find((m) => m.market.name === marketName)! };
  });
  if (debtPairs.length > 0) {
    const accountData = await client.multicall({
      contracts: debtPairs.map(
        (p) => ({ address: p.market.pool, abi: poolAbi, functionName: "getUserAccountData", args: [p.user] }) as const,
      ),
      allowFailure: true,
    });
    accountData.forEach((r, i) => {
      if (r.status !== "success") return;
      healthFactors.push({
        user: debtPairs[i].user,
        chainName: cfg.name,
        market: debtPairs[i].market.market.name,
        healthFactor: Number(formatUnits(r.result[5], 18)),
      });
    });
  }

  return { holdings, healthFactors, errors };
}

async function getTokenMeta(client: PublicClient, cfg: ChainConfig, tokens: Address[]) {
  const missing = tokens.filter((t) => !tokenMetaCache.has(`${cfg.key}:${t}`));
  if (missing.length > 0) {
    const results = await client.multicall({
      contracts: missing.flatMap(
        (t) =>
          [
            { address: t, abi: erc20Abi, functionName: "symbol" },
            { address: t, abi: erc20Abi, functionName: "decimals" },
          ] as const,
      ),
      allowFailure: true,
      batchSize: MULTICALL_BATCH_BYTES,
    });
    missing.forEach((t, i) => {
      const symbol = results[i * 2];
      const decimals = results[i * 2 + 1];
      tokenMetaCache.set(
        `${cfg.key}:${t}`,
        decimals.status === "success"
          ? { symbol: symbol.status === "success" ? String(symbol.result) : "UNKNOWN", decimals: Number(decimals.result) }
          : null,
      );
    });
  }
  return new Map(tokens.map((t) => [t, tokenMetaCache.get(`${cfg.key}:${t}`) ?? null]));
}

async function getMarketMeta(client: PublicClient, cfg: ChainConfig, market: LendingMarket): Promise<MarketMeta> {
  const cacheKey = `${cfg.key}:${market.addressesProvider}`;
  const cached = marketMetaCache.get(cacheKey);
  if (cached && Date.now() - cached.at < METADATA_TTL_MS) return cached.meta;

  const provider = { address: market.addressesProvider, abi: addressesProviderAbi } as const;
  const [pool, dataProvider] = await Promise.all([
    client.readContract({ ...provider, functionName: "getPool" }),
    client.readContract({ ...provider, functionName: "getPoolDataProvider" }),
  ]);
  const reserves = await client.readContract({
    address: dataProvider,
    abi: dataProviderAbi,
    functionName: "getAllReservesTokens",
  });

  const [tokenAddresses, decimals] = await Promise.all([
    client.multicall({
      contracts: reserves.map(
        (r) =>
          ({ address: dataProvider, abi: dataProviderAbi, functionName: "getReserveTokensAddresses", args: [r.tokenAddress] }) as const,
      ),
      allowFailure: false,
      batchSize: MULTICALL_BATCH_BYTES,
    }),
    client.multicall({
      contracts: reserves.map((r) => ({ address: r.tokenAddress, abi: erc20Abi, functionName: "decimals" }) as const),
      allowFailure: false,
      batchSize: MULTICALL_BATCH_BYTES,
    }),
  ]);

  const meta: MarketMeta = {
    market,
    pool,
    reserves: reserves.map((r, i) => {
      const [aToken, stableDebt, variableDebt] = tokenAddresses[i];
      return {
        asset: r.tokenAddress,
        symbol: r.symbol,
        decimals: Number(decimals[i]),
        aToken,
        debtTokens: [variableDebt, stableDebt].filter((a) => a !== zeroAddress),
      };
    }),
  };
  marketMetaCache.set(cacheKey, { at: Date.now(), meta });
  return meta;
}
