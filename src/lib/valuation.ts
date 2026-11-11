import type { AddressPortfolio, Holding, PortfolioResponse } from "./types";

export type DefaultPrice = { price: number; symbol: string; chainName: string };

export type Settings = {
  /** User-defined fallback prices keyed by Holding.priceKey. */
  defaultPrices: Record<string, DefaultPrice>;
  /** Symbols counted as ETH (case-insensitive). */
  ethDerivatives: string[];
  /** Symbols counted towards the stablecoin total (case-insensitive). */
  stablecoins: string[];
  hideSmallBalances: boolean;
  /** Manually entered balances for assets held outside the tracked EVM addresses, keyed by ManualAsset.symbol. */
  manualBalances: Record<string, number>;
};

export type ManualAsset = { symbol: string; name: string; priceKey: string; defaultBalance: number };

/** Non-EVM assets entered by hand. The server fetches a price for each priceKey (DefiLlama coin id). */
export const MANUAL_ASSETS: ManualAsset[] = [
  { symbol: "BTC", name: "Bitcoin", priceKey: "coingecko:bitcoin", defaultBalance: 2.171 },
  { symbol: "SOL", name: "Solana", priceKey: "coingecko:solana", defaultBalance: 247 },
];

export const DEFAULT_ETH_DERIVATIVES = [
  "ETH", "WETH", "stETH", "wstETH", "rETH", "cbETH", "weETH", "eETH", "mETH", "cmETH",
  "osETH", "ezETH", "rsETH", "frxETH", "sfrxETH", "ETHx", "swETH", "ankrETH", "OETH",
];

export const DEFAULT_STABLECOINS = [
  "USDC", "USDC.e", "USDbC", "USDT", "USDT0", "DAI", "sDAI", "USDS", "sUSDS", "GHO", "sGHO", "stkGHO",
  "USDe", "sUSDe", "FRAX", "LUSD", "BOLD", "PYUSD", "crvUSD", "scrvUSD", "USDP", "TUSD", "fUSDC", "fUSDT",
];

export const DEFAULT_SETTINGS: Settings = {
  defaultPrices: {},
  ethDerivatives: DEFAULT_ETH_DERIVATIVES,
  stablecoins: DEFAULT_STABLECOINS,
  hideSmallBalances: true,
  manualBalances: Object.fromEntries(MANUAL_ASSETS.map((a) => [a.symbol, a.defaultBalance])),
};

export const SMALL_BALANCE_USD = 1;

export type PriceSource = "market" | "default" | "eth" | "peg" | "none";

export type ValuedHolding = Holding & {
  price: number | null;
  priceSource: PriceSource;
  /** Signed USD value; negative for debt. */
  value: number;
  isEth: boolean;
  /** Signed ETH-equivalent amount (0 when not an ETH derivative). */
  ethAmount: number;
  isStable: boolean;
};

export type ValuedAddress = Omit<AddressPortfolio, "holdings"> & {
  holdings: ValuedHolding[];
  total: number;
  totalEth: number;
};

export type ValuedManualAsset = ManualAsset & {
  balance: number;
  price: number | null;
  priceSource: "market" | "default" | "none";
  value: number;
};

export type Summary = {
  addresses: ValuedAddress[];
  manualAssets: ValuedManualAsset[];
  total: number;
  totalEth: number;
  /** USD value of stablecoins held or supplied; borrowed stablecoins are not subtracted. */
  totalStable: number;
  /** Net worth minus the net stablecoin position (stablecoins held minus stablecoins borrowed). */
  totalVolatile: number;
  supplied: number;
  borrowed: number;
  ethPrice: number | null;
};

export function valuePortfolio(portfolio: PortfolioResponse, settings: Settings): Summary {
  const ctx: ValuationContext = {
    settings,
    derivatives: new Set(settings.ethDerivatives.map((s) => s.toLowerCase())),
    stablecoins: new Set(settings.stablecoins.map((s) => s.toLowerCase())),
    ethPrice: portfolio.ethPrice,
  };
  const { ethPrice } = portfolio;
  let supplied = 0;
  let borrowed = 0;
  let totalStable = 0;
  let netStable = 0;

  const addresses = portfolio.addresses.map((a) => {
    const holdings = a.holdings.map((h) => valueHolding(h, ctx));
    for (const h of holdings) {
      if (h.kind === "supply") supplied += h.value;
      if (h.kind === "debt") borrowed -= h.value;
      if (h.isStable) netStable += h.value;
      if (h.isStable && h.kind !== "debt") totalStable += h.value;
    }
    holdings.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    return {
      ...a,
      holdings,
      total: sum(holdings.map((h) => h.value)),
      totalEth: sum(holdings.filter((h) => h.kind !== "debt").map((h) => h.ethAmount)),
    };
  });

  const manualAssets = MANUAL_ASSETS.map((asset) =>
    valueManualAsset(asset, portfolio.assetPrices?.[asset.priceKey] ?? null, settings),
  );
  const total = sum(addresses.map((a) => a.total)) + sum(manualAssets.map((a) => a.value));

  return {
    addresses,
    manualAssets,
    total,
    totalEth: sum(addresses.map((a) => a.totalEth)),
    totalStable,
    totalVolatile: total - netStable,
    supplied,
    borrowed,
    ethPrice,
  };
}

type ValuationContext = {
  settings: Settings;
  derivatives: Set<string>;
  stablecoins: Set<string>;
  ethPrice: number | null;
};

function valueHolding(h: Holding, { settings, derivatives, stablecoins, ethPrice }: ValuationContext): ValuedHolding {
  // Discovered tokens can be spam named "WETH" etc., so only trusted tokens count as ETH.
  const isEth = h.trusted && derivatives.has(h.symbol.toLowerCase());
  const symbolIsStable = stablecoins.has(h.symbol.toLowerCase());
  const userDefault = settings.defaultPrices[h.priceKey]?.price;

  let price: number | null = null;
  let priceSource: PriceSource = "none";
  if (h.marketPrice !== null) {
    price = h.marketPrice;
    priceSource = "market";
  } else if (userDefault !== undefined) {
    price = userDefault;
    priceSource = "default";
  } else if (isEth && ethPrice !== null) {
    price = ethPrice;
    priceSource = "eth";
  } else if (symbolIsStable && h.trusted) {
    price = 1;
    priceSource = "peg";
  }

  // Spam tokens named "USDC" have no price, so untrusted tokens only count once they have one.
  const isStable = symbolIsStable && (h.trusted || price !== null);

  const sign = h.kind === "debt" ? -1 : 1;
  const value = sign * h.amount * (price ?? 0);
  // ETH-equivalent by value so wrapped tokens (wstETH, rETH, ...) count at their exchange rate.
  const ethAmount = !isEth ? 0 : price !== null && ethPrice ? value / ethPrice : sign * h.amount;

  return { ...h, price, priceSource, value, isEth, ethAmount, isStable };
}

function valueManualAsset(asset: ManualAsset, marketPrice: number | null, settings: Settings): ValuedManualAsset {
  const balance = settings.manualBalances[asset.symbol] ?? asset.defaultBalance;
  const userDefault = settings.defaultPrices[asset.priceKey]?.price;
  const [price, priceSource]: [number | null, ValuedManualAsset["priceSource"]] =
    marketPrice !== null ? [marketPrice, "market"] : userDefault !== undefined ? [userDefault, "default"] : [null, "none"];
  return { ...asset, balance, price, priceSource, value: balance * (price ?? 0) };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
