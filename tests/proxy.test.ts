// Pilot tests for LO1. Covers RR-1, RR-4.
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const req = (auth?: string) =>
  new NextRequest("http://localhost/", { headers: auth ? { authorization: auth } : {} });
const basic = (u: string, p: string) => `Basic ${btoa(`${u}:${p}`)}`;

afterEach(() => { delete process.env.APP_PASSWORD; delete process.env.APP_USERNAME; });

describe("RR-1 basic auth", () => {
  it("passes everything when APP_PASSWORD is unset", () => {
    expect(proxy(req()).status).toBe(200);
  });
  it("rejects missing credentials with 401 and WWW-Authenticate", () => {
    process.env.APP_PASSWORD = "pw";
    const res = proxy(req());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });
  it("accepts correct credentials and rejects wrong ones", () => {
    process.env.APP_PASSWORD = "pw";
    expect(proxy(req(basic("admin", "pw"))).status).toBe(200);
    expect(proxy(req(basic("admin", "bad"))).status).toBe(401);
  });
  it("allows passwords containing a colon", () => {
    process.env.APP_PASSWORD = "p:w";
    expect(proxy(req(basic("admin", "p:w"))).status).toBe(200);
  });
});

describe("RR-4 malformed Authorization header", () => {
  it("returns 401 for a header with no colon", () => {
    process.env.APP_PASSWORD = "pw";
    expect(proxy(req(`Basic ${btoa("nocolon")}`)).status).toBe(401);
  });
  // Regression test for KB-1 (fixed): atob() used to throw on invalid base64 instead of returning 401.
  // See docs/known-bugs.md for diagnosis, failing run and passing run.
  it("returns 401 for invalid base64", () => {
    process.env.APP_PASSWORD = "pw";
    expect(proxy(req("Basic !!!not-base64!!!")).status).toBe(401);
  });
});
