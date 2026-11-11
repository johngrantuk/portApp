import "server-only";
import type { Address } from "viem";
import type { ChainConfig } from "./chains";

/**
 * Best-effort discovery of ERC-20 tokens held by an address, beyond the curated list.
 * Uses Alchemy when ALCHEMY_API_KEY is set (all configured chains), otherwise Blockscout where available.
 * Balances are always re-read on-chain; this only returns token contract addresses.
 */
export async function discoverTokens(cfg: ChainConfig, user: Address): Promise<Address[]> {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey && cfg.alchemyNetwork) return discoverViaAlchemy(cfg.alchemyNetwork, alchemyKey, user);
  if (cfg.blockscoutUrl) return discoverViaBlockscout(cfg.blockscoutUrl, user);
  return [];
}

async function discoverViaBlockscout(baseUrl: string, user: Address): Promise<Address[]> {
  const res = await fetch(`${baseUrl}/api/v2/addresses/${user}/token-balances`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Blockscout ${res.status}`);
  const items = (await res.json()) as { token: { address_hash?: string; address?: string; type: string } }[];
  return items
    .filter((i) => i.token.type === "ERC-20")
    .map((i) => (i.token.address_hash ?? i.token.address) as Address)
    .filter(Boolean);
}

async function discoverViaAlchemy(network: string, key: string, user: Address): Promise<Address[]> {
  const tokens: Address[] = [];
  let pageKey: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`https://${network}.g.alchemy.com/v2/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [user, "erc20", ...(pageKey ? [{ pageKey }] : [])],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Alchemy ${res.status}`);
    const json = (await res.json()) as {
      result?: { tokenBalances: { contractAddress: Address; tokenBalance: string | null }[]; pageKey?: string };
      error?: { message: string };
    };
    if (json.error) throw new Error(`Alchemy: ${json.error.message}`);
    for (const t of json.result?.tokenBalances ?? []) {
      if (t.tokenBalance && BigInt(t.tokenBalance) > BigInt(0)) tokens.push(t.contractAddress);
    }
    pageKey = json.result?.pageKey;
    if (!pageKey) break;
  }
  return tokens;
}
