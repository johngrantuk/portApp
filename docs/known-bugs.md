# Known bugs

## KB-1: proxy crashes on invalid base64 Authorization header (RR-4)

- **Test:** `tests/proxy.test.ts`, "returns 401 for invalid base64" (was `it.fails` while the bug was open; now a normal regression test).
- **Failing run:** `docs/evidence/rr-4-proxy-invalid-base64-failing-run.txt` (1 failed, 5 passed; `InvalidCharacterError` from `atob`).
  The failing run was captured retrospectively: the test was first written as `it.fails`, then temporarily switched to `it` to record the failure. No code was changed in between.
- **Diagnosis:** real code bug. The expectation is right: requirements RR-1/RR-4 say malformed credentials get 401. `src/proxy.ts` calls `atob(encoded)` unguarded, so the request throws instead of returning 401.
- **Status:** fixed. The fix was deferred until after the LO1 commit so it could be done test-first, in its own commit, as evidence for LO2/LO3 and 4.3.
- **Fix:** `src/proxy.ts` wraps `atob` in try/catch and falls through to the 401 response. The test body is unchanged; only `.fails` was removed.
- **Passing run:** `docs/evidence/rr-4-proxy-invalid-base64-passing-run.txt` (21 passed, 0 failed).
- **Counts as:** found-then-fixed defect for 4.3 and the test plan's effectiveness (LO2/LO3). It was a gap for 4.1 until fixed.
