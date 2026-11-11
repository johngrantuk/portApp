# Known bugs

## KB-1: proxy crashes on invalid base64 Authorization header (RR-4)

- **Test:** `tests/proxy.test.ts`, "returns 401 for invalid base64" (marked `it.fails`).
- **Failing run:** `docs/evidence/rr-4-proxy-invalid-base64-failing-run.txt` (1 failed, 5 passed; `InvalidCharacterError` from `atob`).
  The failing run was captured retrospectively: the test was first written as `it.fails`, then temporarily switched to `it` to record the failure. No code was changed in between.
- **Diagnosis:** real code bug. The expectation is right: requirements RR-1/RR-4 say malformed credentials get 401. `src/proxy.ts` calls `atob(encoded)` unguarded, so the request throws instead of returning 401.
- **Status:** unfixed. Reason: LO1 is requirements analysis; the fix is deferred so it can be done test-first, in its own commit, as evidence for LO2/LO3 and 4.3.
- **Plan:** wrap `atob` in try/catch and fall through to the 401 response. Keep the test unchanged except removing `.fails`, then save the passing run to `docs/evidence/`.
- **Counts as:** gap for 4.1 until fixed.
