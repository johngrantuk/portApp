import "server-only";

export type LlamaPrice = { price: number; confidence?: number };

const CHUNK_SIZE = 60;

/** Fetches current USD prices from DefiLlama (free, no API key). Keys are like "ethereum:0xabc..." or "coingecko:ethereum". */
export async function fetchPrices(keys: string[]): Promise<Map<string, LlamaPrice>> {
  const unique = [...new Set(keys.map((k) => k.toLowerCase()))];
  const prices = new Map<string, LlamaPrice>();

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) chunks.push(unique.slice(i, i + CHUNK_SIZE));

  await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch(`https://coins.llama.fi/prices/current/${chunk.join(",")}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`DefiLlama prices request failed: ${res.status}`);
      const json = (await res.json()) as { coins: Record<string, LlamaPrice> };
      for (const [key, value] of Object.entries(json.coins ?? {})) {
        if (typeof value.price === "number") prices.set(key.toLowerCase(), value);
      }
    }),
  );

  return prices;
}
