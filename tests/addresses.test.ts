// Pilot tests for LO1. Covers FR-6, RR-2.
import { afterEach, describe, expect, it } from "vitest";
import { getTrackedAddresses } from "@/lib/server/addresses";

const A = "0x0000000000000000000000000000000000000001";
const B = "0x0000000000000000000000000000000000000002";
afterEach(() => { delete process.env.PORTFOLIO_ADDRESSES; });

describe("FR-6 parsing", () => {
  it("parses labels, de-duplicates case-insensitively and shortens default labels", () => {
    process.env.PORTFOLIO_ADDRESSES = `${A}:Main,${A.toUpperCase().replace("0X", "0x")},${B}`;
    const r = getTrackedAddresses();
    expect(r).toHaveLength(2);
    expect(r[0].label).toBe("Main");
    expect(r[1].label).toBe("0x0000…0002");
  });
  it("returns [] when unset", () => {
    expect(getTrackedAddresses()).toEqual([]);
  });
});

describe("RR-2 invalid input", () => {
  it("throws naming the bad address", () => {
    process.env.PORTFOLIO_ADDRESSES = "0xnothex";
    expect(() => getTrackedAddresses()).toThrow(/0xnothex/);
  });
});
