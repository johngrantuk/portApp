# Test plan (LO2)

Requirement IDs are from `docs/requirements.md`; approach per kind/level is from `docs/test-approach.md` (LO1). All fixtures use dummy addresses (`0x…0001`).
Evidence from the run on 2026-11-11 (Vitest 5.1.0, `@vitest/coverage-v8` 5.1.0):

- Test run: `docs/evidence/lo2-test-run.txt` (7 files, 43 passed, 0 failed).
- Traceability: `docs/evidence/lo2-traceability.txt` (16 of 19 requirements have an automated test).
- Coverage: `docs/evidence/lo2-coverage.txt` (text) and `docs/evidence/lo2-coverage-summary.json` (per file).

## 2.1 Plan

| Req | Technique | Test (file, describe) | Status |
|---|---|---|---|
| FR-1..FR-5, QR-2 | Black-box examples, boundary values, timing threshold | `tests/valuation.test.ts` | Done (LO1 pilot, 12 tests) |
| FR-6, RR-2 | Equivalence classes on env input | `tests/addresses.test.ts` | Done (3) |
| RR-1, RR-4 | Negative tests on headers | `tests/proxy.test.ts` | Done (6); KB-1 found test-first |
| LR-1 | Example tests on format helpers | `tests/format.test.ts` | Done in LO2 (5) |
| FR-8 | Mocked `fetch`; chunk sizes, dedupe, error status | `tests/prices.test.ts` | Done in LO2 (5) |
| FR-7, FR-8 (attach), RR-3 | Test doubles for viem client, discovery, prices; fault injection per failure source | `tests/portfolio.test.ts` | Done in LO2 (9) |
| FR-9, QR-1 | Route handler called directly with mocked `getPortfolio`; `maxDuration` constant | `tests/route.test.ts` | Done in LO2 (3). QR-1 only checks the declared limit, not real duration |
| FR-10, LR-2 | Component rendering / UI checklist | none | Planned for LO5 review (no component test setup) |
| RR-5 | Secrets search, `server-only` boundary | none | Planned for LO5 |
| QR-1 (real duration) | Manual timing of a live refresh | none | Planned manual (LO3/LO4) |

**Evolution of the test set (TDD-style, in commit order).**
1. LO1 pilot (commit `87fe6d0`): tests for FR-1..FR-6, QR-2, RR-1, RR-2, RR-4. The RR-4 invalid-base64 test was written first, failed (`docs/evidence/rr-4-proxy-invalid-base64-failing-run.txt`) and was fixed in `2712215` with the test unchanged (`docs/known-bugs.md`, KB-1).
2. LO2: tests added for each planned integration/system requirement, then run. First run of `tests/portfolio.test.ts`: 6 of 9 failed. Diagnosis: the test is wrong, not the code. The viem double returned `{status, result}` objects for `multicall` calls that use `allowFailure: false` (real viem returns bare values). Fixed the double; no application code was changed. That failing output was not saved (gap in process, noted here for honesty).

## 2.2 Plan quality

**Strengths**
- Every requirement has either a test or a named reason it has none (table above); the script `npm run trace` checks this mechanically.
- RR-3 is tested per failure source (chain RPC, price request, discovery, market lookup, native balance), not just once.
- Pure logic is covered at 100% statements (`valuation.ts`, `format.ts`, `addresses.ts`, `proxy.ts`).

**Omissions**
- FR-10, LR-2, RR-5: no automated tests; UI and secrets are left to LO5 review.
- `src/lib/server/chains.ts` (`rpcUrlFor`: env override > Alchemy URL > default) and `src/lib/server/discovery.ts` (Alchemy/Blockscout parsing) have 0% coverage; both are mocked in `portfolio.test.ts`.
- Unit tests for `valuation.ts` are examples only; combinations of price settings are not exhaustively explored (mutation testing is LO3).
- QR-1 is a constant check; a slow live refresh would not be detected.

**Vulnerabilities**
- Test doubles encode my reading of viem and Aave behaviour. The LO2 double bug (above) shows they can be wrong. Real RPC batch limits, Aave contract behaviour and DefiLlama responses are never exercised.
- QR-2 uses a 50 ms threshold against about 1 ms observed. It only catches gross regressions and may flake on a loaded CI machine.
- `portfolio.test.ts` uses `vi.resetModules()` to avoid module-level cache leakage; a test that forgets this would become order-dependent.

## 2.3 Instrumentation

| Instrument | Where | Why |
|---|---|---|
| V8 coverage (statements, branches, functions, lines) | `vitest.config.mts` `coverage`; `npm run coverage` | Shows which application code the tests never run; scope is `src/lib`, `src/proxy.ts`, `src/app/api`. Components are excluded because they have no tests (LO5). |
| Requirement-ID tags in `describe` names (`FR-7 …`) | `tests/*.test.ts` | Makes failures and reports read in terms of requirements. |
| Traceability script | `scripts/trace.mjs`, `npm run trace` | Lists each requirement ID from `docs/requirements.md` with the test files that mention it; reports requirements without tests. |
| Assertions in the tests under test | `expect(...)` on values and on mock calls (`fetchMock` call count, request sizes) | Checks behaviour and, for chunking, the interaction. |
| Saved run output | `docs/evidence/lo2-*.txt`, `docs/evidence/rr-4-*.txt` | Reproducible evidence for each quoted number. |

No logging or runtime assertions were added to the application: errors already surface in `PortfolioResponse.errors`, which the tests read, and extra logging in a personal dashboard would add noise and risk leaking addresses.

## 2.4 Instrumentation quality

**Adequate**
- Coverage shows 87.82% statements, 76.21% branches, 91.86% functions, 89.32% lines overall. Per-file numbers are in `docs/evidence/lo2-coverage-summary.json`.
- Coverage reports uncovered lines by number (`portfolio.ts` 81, 240; `valuation.ts` 168; `route.ts` 12; `prices.ts` 23), which points to specific missing tests.
- Traceability catches a requirement that silently loses its test.

**Missing or weak**
- Line/branch coverage does not show whether assertions would detect a fault. `portfolio.test.ts` can reach a line without checking its result. A mutation tool (LO3) is needed for that.
- Traceability only checks that an ID is mentioned in a test file, not that the test checks it.
- The text coverage table hides files at 100/100 (`format.ts`, `addresses.ts`, `proxy.ts`); the JSON summary has them.
- No coverage threshold is enforced, and nothing runs in CI yet (LO5).
- Coverage is measured on the mocked integration tests, so `portfolio.ts` at 96.83% statements says nothing about behaviour against real chains.
