// Requirement-to-test traceability (instrumentation for LO2 2.3).
// Lists every requirement ID in docs/requirements.md and the test files that mention it.
import { readFileSync, readdirSync } from "node:fs";

const ids = [...readFileSync("docs/requirements.md", "utf8").matchAll(/^\| ((?:FR|QR|LR|RR)-\d+) \|/gm)].map((m) => m[1]);
const tests = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));
const text = Object.fromEntries(tests.map((f) => [f, readFileSync(`tests/${f}`, "utf8")]));

let missing = 0;
for (const id of ids) {
  const hits = tests.filter((f) => new RegExp(`\\b${id}\\b`).test(text[f]));
  if (hits.length === 0) missing++;
  console.log(`${id.padEnd(5)} ${hits.length ? hits.join(", ") : "NO AUTOMATED TEST"}`);
}
console.log(`\n${ids.length - missing}/${ids.length} requirements have an automated test; ${missing} without.`);
