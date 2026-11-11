import "server-only";
import { getAddress, isAddress, type Address } from "viem";

export type TrackedAddress = { address: Address; label: string };

/**
 * Reads PORTFOLIO_ADDRESSES, a comma-separated list of `address` or `address:label`.
 * Example: PORTFOLIO_ADDRESSES="0xabc...:Main,0xdef...:Cold storage"
 */
export function getTrackedAddresses(): TrackedAddress[] {
  const raw = process.env.PORTFOLIO_ADDRESSES ?? "";
  const seen = new Set<string>();
  const result: TrackedAddress[] = [];

  for (const entry of raw.split(/[,\n]/)) {
    const [addr, ...labelParts] = entry.trim().split(":");
    if (!addr) continue;
    if (!isAddress(addr, { strict: false })) {
      throw new Error(`Invalid address in PORTFOLIO_ADDRESSES: ${addr}`);
    }
    const address = getAddress(addr);
    if (seen.has(address)) continue;
    seen.add(address);
    result.push({
      address,
      label: labelParts.join(":").trim() || `${address.slice(0, 6)}…${address.slice(-4)}`,
    });
  }
  return result;
}
