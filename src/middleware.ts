import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawUrl = request.url;

  // Path traversal defense in request URL
  if (
    pathname.includes("..") ||
    pathname.includes("%2e%2e") ||
    rawUrl.includes("..") ||
    rawUrl.includes("%2e%2e") ||
    rawUrl.toLowerCase().includes("%252e")
  ) {
    return new NextResponse("Bad Request - Invalid Path", { status: 400 });
  }

  // CSRF Defense: Cross-Origin State-Changing Mutation Guard
  const method = request.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isMutation && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (host && originUrl.host.toLowerCase() !== host.toLowerCase()) {
          return new NextResponse(
            JSON.stringify({ success: false, error: "CSRF check failed: Cross-origin mutation request blocked." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ success: false, error: "CSRF check failed: Malformed Origin header." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (host && refererUrl.host.toLowerCase() !== host.toLowerCase()) {
          return new NextResponse(
            JSON.stringify({ success: false, error: "CSRF check failed: Cross-origin referer blocked." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ success: false, error: "CSRF check failed: Malformed Referer header." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  // Authentication Guard for Web Page Routes
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/uploads/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.includes(".");

  const sessionCookie = request.cookies.get("actis_session")?.value;

  // Root URL redirection: direct to /login if unauthenticated, /queue if authenticated
  if (pathname === "/") {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL("/queue", request.url));
  }

  // Redirect unauthenticated visitors attempting to access protected pages to /login
  if (!isPublicRoute && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  // Security Headers for Defense-in-Depth
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: ws: wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

