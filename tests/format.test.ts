// LO2 unit tests for src/lib/format.ts. Covers LR-1 (example-based; look and feel is reviewed in LO5).
import { describe, expect, it } from "vitest";
import { formatAmount, formatPrice, formatUsd, shortAddress, timeAgo } from "@/lib/format";

describe("LR-1 number and address formatting", () => {
  it("formats USD with 2 decimals, or whole dollars on request", () => {
    expect(formatUsd(1234.567)).toBe("$1,234.57");
    expect(formatUsd(1234.567, { whole: true })).toBe("$1,235");
    expect(formatUsd(-5)).toBe("-$5.00");
  });
  it("shows small prices in 3 significant digits", () => {
    expect(formatPrice(0)).toBe("$0");
    expect(formatPrice(0.000123456)).toBe("$0.000123");
    expect(formatPrice(0.5)).toBe("$0.50");
  });
  it("chooses amount precision by magnitude", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(0.00001)).toBe("1.00e-5");
    expect(formatAmount(0.123456789)).toBe("0.123457");
    expect(formatAmount(12.345678)).toBe("12.3457");
    expect(formatAmount(12345.678)).toBe("12,345.68");
    expect(formatAmount(2e12)).toBe("2.000e+12");
  });
  it("shortens addresses", () => {
    expect(shortAddress("0x0000000000000000000000000000000000000001")).toBe("0x0000…0001");
  });
  it("describes elapsed time", () => {
    const now = Date.parse("2026-01-02T00:00:00Z");
    expect(timeAgo("2026-01-02T00:00:00Z", now)).toBe("just now");
    expect(timeAgo("2026-01-01T23:50:00Z", now)).toBe("10m ago");
    expect(timeAgo("2026-01-01T20:00:00Z", now)).toBe("4h ago");
    expect(timeAgo("2025-12-29T00:00:00Z", now)).toBe("4d ago");
  });
});
