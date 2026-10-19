import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("İnzibatçı parolu konfiqurasiya edilməyib.", { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const encodedCredentials = authorization.startsWith("Basic ")
    ? authorization.slice(6)
    : "";

  let suppliedPassword = "";
  try {
    const credentials = atob(encodedCredentials);
    suppliedPassword = credentials.slice(credentials.indexOf(":") + 1);
  } catch {
    suppliedPassword = "";
  }

  if (suppliedPassword !== password) {
    return new NextResponse("İnzibatçı girişi tələb olunur.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
