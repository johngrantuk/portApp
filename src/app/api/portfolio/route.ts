import { connection } from "next/server";
import { getPortfolio } from "@/lib/server/portfolio";

export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const portfolio = await getPortfolio();
    return Response.json(portfolio, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
