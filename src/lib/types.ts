export type HoldingKind = "wallet" | "supply" | "debt";

export type Holding = {
  id: string;
  chainKey: string;
  chainName: string;
  /** Token contract address (lowercase) or "native". For lending positions this is the underlying asset. */
  token: string;
  symbol: string;
  amount: number;
  kind: HoldingKind;
  /** Lending market name for supply/debt positions, e.g. "Aave V3 Core". */
  market?: string;
  /** Token comes from the curated list, a lending market, or is native. Discovered tokens are untrusted (could be spam). */
  trusted: boolean;
  /** DefiLlama coin id, also used as the key for user-defined default prices. */
  priceKey: string;
  marketPrice: number | null;
};

export type HealthFactor = {
  chainName: string;
  market: string;
  healthFactor: number;
};

export type AddressPortfolio = {
  address: string;
  label: string;
  holdings: Holding[];
  healthFactors: HealthFactor[];
};

export type PortfolioResponse = {
  fetchedAt: string;
  ethPrice: number | null;
  /** Prices for manually entered assets, keyed by DefiLlama coin id. */
  assetPrices: Record<string, number | null>;
  addresses: AddressPortfolio[];
  errors: string[];
};
