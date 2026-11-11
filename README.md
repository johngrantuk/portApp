# Portfolio

Mobile-friendly, multi-chain crypto portfolio tracker. Next.js app, deployable for free on Vercel.

- Wallet balances (native + ERC-20) on Ethereum, Arbitrum and Polygon
- Lending positions on Aave V3 (Core, Lido, EtherFi markets) and Spark: supplied assets count positive, debt negative, with health factor
- USD prices from [DefiLlama](https://defillama.com/docs/api) (free, no key), with editable default prices for tokens without a feed
- Total ETH across the portfolio, with an editable list of ETH derivatives (WETH, stETH, wstETH, …)
- Last result is cached in the browser; the Refresh button fetches fresh data

## Requirements

- Easy and free to host on Vercel; mobile friendly.
- Input is a list of EVM addresses. They are kept private (environment variable, never committed to the repo).
- Multi-chain: Ethereum mainnet, Arbitrum and Polygon to start, with an easy way to add more chains.
- Display the total USD value of the portfolio, and the USD value of each address.
- Prices come from a free price feed. If a token has no price, fall back to a stored default price that can be changed manually in the UI.
- The last prices are cached, and a button in the UI triggers a refresh.
- Display the total amount of ETH in the portfolio. ETH derivatives (WETH, stETH, wstETH, …) count as ETH, and the list of derivatives can be changed manually in the UI.
- Work out the net value of an address when it has a loan or borrow on a lending protocol such as Aave.

## Setup

```bash
npm install
cp .env.example .env.local   # then edit PORTFOLIO_ADDRESSES
npm run dev
```

Addresses are only read on the server from `PORTFOLIO_ADDRESSES`. `.env*` files are git-ignored, so they never end up in the repo.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. In Project → Settings → Environment Variables, add `PORTFOLIO_ADDRESSES` and, recommended, `APP_PASSWORD` (the page shows your addresses and balances to anyone with the URL otherwise).
3. Deploy.

## How it works

| Piece | Where |
| --- | --- |
| Chains, curated tokens, lending markets | `src/lib/server/chains.ts` |
| Balance + Aave reads (viem multicall over public RPCs) | `src/lib/server/portfolio.ts` |
| Token discovery (Blockscout on Ethereum, or Alchemy on all chains if `ALCHEMY_API_KEY` is set) | `src/lib/server/discovery.ts` |
| Valuation: price fallbacks, ETH totals | `src/lib/valuation.ts` |

Price resolution per token: DefiLlama market price → your default price → ETH price (only for ETH derivatives) → unpriced.
ETH totals are value-based, so 1 wstETH counts as ~1.2 ETH. The ETH and stablecoin totals count held and supplied tokens only; borrowed amounts reduce net worth but not these totals.

Default prices, the derivatives list and the cached snapshot live in the browser's `localStorage`, so they are per device.

### Adding a chain

Add an entry to `CHAINS` in `src/lib/server/chains.ts` (viem chain, DefiLlama chain prefix, public RPC, native token, tokens to always check, Aave V3 `PoolAddressesProvider`s). Optionally set `RPC_URL_<KEY>`.

### Adding a token or lending market

Append the token address to the chain's `tokens` (symbol/decimals are read on-chain), or add any Aave V3 / fork `PoolAddressesProvider` to `lendingMarkets`.

## Limitations

- Without `ALCHEMY_API_KEY`, tokens on Arbitrum and Polygon are only found if they are in the curated list. A free Alchemy key enables full discovery.
- Only Aave V3–style lending markets are decoded. Other DeFi positions (LP tokens, Morpho, Compound, Pendle, …) show up only if they are plain ERC-20s with a DefiLlama price.
- Airdropped spam tokens are hidden unless they have a market price or you set a default price.
