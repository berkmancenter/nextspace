import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import decryptCookie from "./utils/Decrypt";
import { JWTDecryptResult } from "jose";
import { validateCookie } from "./utils/cookieValidator";

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  try {
    const token = (await cookies()).get("nextspace-session")?.value;
    // If no token and trying to access admin, redirect to signup, else mark as guest
    if (!token) {
      if (isAdminRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        return NextResponse.redirect(url);
      }

      requestHeaders.set("x-auth-type", "guest");
      return NextResponse.next({ headers: requestHeaders });
    }
    const cookie: JWTDecryptResult = await decryptCookie(token);

    // Validate cookie format and structure
    const validation = validateCookie(cookie);
    if (!validation.isValid) {
      console.warn("Invalid cookie detected:", validation.error);
      throw new Error(`Invalid cookie: ${validation.error}`);
    }

    // Ensure the decrypted cookie has access token
    if (!cookie || !cookie.payload.access) throw new Error("Not logged in");
    
    // Set authType from cookie (defaults to "guest" if not present)
    const authType = (cookie.payload.authType as string) || "guest";
    requestHeaders.set("x-auth-type", authType);

    // Only allow admin users to access admin routes
    if (isAdminRoute && authType !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/signup";
      return NextResponse.redirect(url);
    }

    // If logged in as admin and hitting /admin exactly, redirect to /admin/events
    if (request.nextUrl.pathname === "/admin" && authType === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/events";
      return NextResponse.redirect(url, { headers: requestHeaders });
    }

    return NextResponse.next({ headers: requestHeaders });
  } catch (e) {
    // jwtDecrypt will throw an error when the token is invalid
    console.error("Middleware auth error:", e);

    // Clear invalid cookie by setting it with an expired date
    const response = NextResponse.next({ headers: requestHeaders });
    response.cookies.set("nextspace-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    // Don't redirect if already on signup or login page to avoid redirect loop
    if (
      request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/login"
    ) {
      requestHeaders.set("x-auth-type", "guest");
      response.headers.set("x-auth-type", "guest");
      return response;
    }

    const url = request.nextUrl.clone();
    // Redirect to signup if trying to access admin routes
    if (isAdminRoute) {
      url.pathname = "/signup";
      return NextResponse.redirect(url, { headers: response.headers });
    }
    
    return NextResponse.redirect(url, { headers: response.headers });
  }
}
