# Requirements: Portfolio dashboard

System under test: a Next.js dashboard that reads on-chain balances (ERC-20, native, Aave-style lending positions) for configured EVM addresses, fetches USD prices from DefiLlama, and shows net worth, ETH exposure and stablecoin exposure.

Source files named below are relative to `src/`. All addresses in tests and docs are dummy values.

Kinds: **F** functional, **Q** measurable quality, **L** qualitative, **R** robustness/security.
Levels: **U** unit, **I** integration, **S** system.

| ID | Kind | Level | Requirement | Code under test |
|---|---|---|---|---|
| FR-1 | F | U | Holding value = amount × price; debt holdings are negative. | `lib/valuation.ts` `valueHolding` |
| FR-2 | F | U | Price precedence: market price, then user default, then ETH price (ETH derivatives), then 1.0 peg (trusted stablecoins), else none (value 0). | `lib/valuation.ts` `valueHolding` |
| FR-3 | F | U | Untrusted (discovered) tokens named like ETH derivatives or stablecoins must not count as ETH or stable unless priced. | `lib/valuation.ts` `valueHolding` |
| FR-4 | F | U | Summary totals: net worth, supplied, borrowed, total ETH, stable total (debt not subtracted), volatile = total minus net stable. | `lib/valuation.ts` `valuePortfolio` |
| FR-5 | F | U | Manual assets (BTC, SOL) are valued with the market price, else user default, else 0. | `lib/valuation.ts` `valueManualAsset` |
| FR-6 | F | U | `PORTFOLIO_ADDRESSES` is parsed as `address[:label]`, de-duplicated, checksummed; default label is a shortened address. | `lib/server/addresses.ts` |
| FR-7 | F | I | Stable and variable debt for the same reserve are merged into one holding; aTokens are reported as supply, not wallet balance. | `lib/server/portfolio.ts` `loadChain` |
| FR-8 | F | I | Prices for unique keys are fetched in chunks of 60 from DefiLlama. | `lib/server/prices.ts` |
| FR-9 | F | S | `GET /api/portfolio` returns a `PortfolioResponse` JSON with `cache-control: no-store`. | `app/api/portfolio/route.ts` |
| FR-10 | F | S | The dashboard renders totals, per-address cards and settings from the API response. | `components/*.tsx` |
| QR-1 | Q | S | A full portfolio refresh completes within the route's 60 s limit (`maxDuration`). | `app/api/portfolio/route.ts` |
| QR-2 | Q | U | Valuation of a realistic portfolio (about 500 holdings) runs in under 50 ms, so UI settings changes feel instant. | `lib/valuation.ts` |
| LR-1 | L | S | Numbers are readable: USD with 2 decimals, small prices in significant digits, amounts with sensible precision, addresses shortened. | `lib/format.ts` |
| LR-2 | L | S | Debt and low-confidence prices are visibly distinguished from normal holdings. | `components/AddressCard.tsx` |
| RR-1 | R | U | When `APP_PASSWORD` is set, requests without matching Basic credentials get 401 with a `WWW-Authenticate` header; when unset, all requests pass. | `proxy.ts` |
| RR-2 | R | U | An invalid address in `PORTFOLIO_ADDRESSES` fails fast with an error naming it. | `lib/server/addresses.ts` |
| RR-3 | R | I | One failing chain, RPC call, discovery call or price request is reported in `errors` and does not abort the rest of the response. | `lib/server/portfolio.ts` `getPortfolio` |
| RR-4 | R | U | Malformed `Authorization` headers must not crash the proxy. | `proxy.ts` |
| RR-5 | R | S | Secrets (`ALCHEMY_API_KEY`, `APP_PASSWORD`, addresses) are never sent to the browser or committed. | `server-only` imports, `.gitignore` |

Known issue found while writing RR-4: `proxy.ts` calls `atob(encoded)` and `decoded.indexOf(":")` without guarding malformed base64 or a missing colon; see `docs/known-bugs.md` (KB-1) and `docs/test-approach.md`.
