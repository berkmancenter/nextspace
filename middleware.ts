import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import decryptCookie from "./utils/Decrypt";
import { JWTDecryptResult } from "jose";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  try {
    const token = (await cookies()).get("nextspace-session")?.value;
    const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
    // If no token and trying to access admin, redirect to signup, else mark as not authenticated
    if (!token) {
      if (isAdminRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        return NextResponse.redirect(url);
      }

      requestHeaders.set("x-is-authenticated", "false");
      return NextResponse.next({ headers: requestHeaders });
    }
    const cookie: JWTDecryptResult = await decryptCookie(token);

    // Ensure the decrypted cookie has access token
    if (!cookie || !cookie.payload.access) throw new Error("Not logged in");
    requestHeaders.set("x-is-authenticated", "true");

    // If logged in and hitting /admin exactly, redirect to /admin/events
    if (request.nextUrl.pathname === "/admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/events";
      return NextResponse.redirect(url, { headers: requestHeaders });
    }

    return NextResponse.next({ headers: requestHeaders });
  } catch (e) {
    // jwtDecrypt will throw an error when the token is invalid
    console.error("Middleware auth error:", e);
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }
}
