# Test approach (LO1)

Requirement IDs refer to `docs/requirements.md`. Pilot run output: `docs/evidence/lo1-pilot-run.txt` (`npm test`, Vitest 5.1.0, 20 passed, 1 expected fail; the expected fail, KB-1, has since been fixed).

## 1.2 Levels

| Level | Requirements | Scope |
|---|---|---|
| Unit | FR-1..FR-6, QR-2, RR-1, RR-2, RR-4 | Pure functions (`valuation.ts`, `format.ts`) and `addresses.ts`, `proxy.ts` with env vars and synthetic requests. |
| Integration | FR-7, FR-8, RR-3 | `portfolio.ts` and `prices.ts` against a mocked RPC and a mocked `fetch`. |
| System | FR-9, FR-10, QR-1, LR-1, LR-2, RR-5 | Running app: `/api/portfolio` route, rendered dashboard, repo/bundle inspection. |

## 1.3 Approach per requirement kind and level

| Kind / level | Approach | Planned in | Status |
|---|---|---|---|
| F / unit | Black-box example tests plus boundary values on pure valuation functions (price precedence, trusted vs untrusted, sign of debt). | LO2/LO3 | Piloted: `tests/valuation.test.ts` (FR-1..FR-5). |
| F / unit (parsing) | Equivalence classes on env input (valid, duplicate, labelled, empty, invalid). | LO2/LO3 | Piloted: `tests/addresses.test.ts` (FR-6, RR-2). |
| F / integration | Test doubles for viem `PublicClient` and `fetch`; assert merged debt, chunking, error aggregation. | LO2/LO3 | Planned, not built. |
| F / system | Route-level test of `GET /api/portfolio` with mocked server modules; component tests for rendering. | LO3 | Planned, not built. |
| Q / unit | Timing assertion on a generated 500-holding portfolio with a generous threshold. | LO3 | Piloted: `tests/valuation.test.ts` (QR-2). |
| Q / system | Manual timing of a live refresh against 60 s limit; no automated test (depends on public RPCs). | LO3/LO4 | Planned, manual. |
| L / system | Manual review of the UI against a checklist; format helpers get example tests. | LO5 (review) | Planned. |
| R / unit | Negative tests: wrong or malformed credentials, invalid addresses. | LO2/LO3 | Piloted: `tests/proxy.test.ts` (RR-1, RR-4). |
| R / integration | Fault injection: make one chain, discovery call or price fetch reject and check `errors` plus partial results. | LO3 | Planned, not built. |
| R / system | Repo search for secrets and for `server-only` boundaries. | LO5 | Planned. |

## 1.4 Appropriateness: honest assessment

- **Example-based unit tests suit valuation.** The functions are pure and deterministic, so tests are cheap and fast (suite runs in under 0.5 s). Limits: examples cover chosen cases only. Combinations of settings (default prices x derivatives x trust) are numerous, so property-based or mutation testing would be needed to show nothing is missed (LO3/LO4).
- **The pilot found a real defect.** RR-4: `proxy.ts` throws on invalid base64 (`atob`) instead of returning 401. It was recorded as `it.fails` so the suite stayed green, then fixed test-first in a later commit; diagnosis, failing run and passing run are in `docs/known-bugs.md` (KB-1). This supports negative testing for security requirements.
- **Mocking limits integration tests.** `portfolio.ts` is about 330 lines of viem multicall logic. Doubles verify our handling of results, not that real Aave contracts, RPC batch limits (the code mentions publicnode rejecting large payloads) or DefiLlama behave as assumed. Those risks stay untested; this is a known gap for LO4.
- **Live-network behaviour is not reproducible.** QR-1 and prices depend on public services, so I do not automate them. A manual measurement is cheaper and more honest than a flaky test.
- **Qualitative requirements (LR-1, LR-2) have weak oracles.** Example tests cover formatting helpers but not whether the UI looks right; review (LO5) fits better, with subjective results.
- **Timing tests are environment-sensitive.** QR-2 uses a threshold about 50x the observed time (observed 1 ms, limit 50 ms) to avoid flakiness, so it only detects gross regressions.
- **Next.js version differences.** The repo uses a newer Next.js (`proxy.ts` replaces middleware); route and component tests may need framework-specific setup, which is a risk for FR-9/FR-10 coverage.
