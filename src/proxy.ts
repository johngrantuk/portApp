import { NextResponse, type NextRequest } from "next/server";

/** Optional HTTP basic auth: set APP_PASSWORD (and optionally APP_USERNAME) to protect the whole app. */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const username = process.env.APP_USERNAME ?? "admin";
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    if (decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Portfolio", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
