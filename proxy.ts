import { NextResponse, type NextRequest } from "next/server";

/** Garante o cookie do aparelho (`cf_aparelho`) nas páginas do cliente, para deduplicar as leituras do QR. */
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("cf_aparelho")) {
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    res.cookies.set("cf_aparelho", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: proto === "https", path: "/", maxAge: 365 * 24 * 60 * 60 });
  }
  return res;
}

export const config = { matcher: ["/r/:path*", "/app/:path*"] };
