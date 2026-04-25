import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "./utils/supabase/middleware";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/config";

export default async function middleware(request: NextRequest) {
  // 1. First, handle Supabase session logic
  const { supabase, supabaseResponse } = createClient(request);
  
  // This refreshes the session if needed
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.includes("/dashboard");
  const isLoginPage = pathname.includes("/login");

  // 2. Auth Protection Logic
  if (isDashboardRoute && !user) {
    const locale = pathname.split("/")[1];
    const prefix = ["en", "es", "ru"].includes(locale) ? `/${locale}` : "/es";
    return NextResponse.redirect(new URL(`${prefix}/login`, request.url));
  }

  if (isLoginPage && user) {
    const locale = pathname.split("/")[1];
    const prefix = ["en", "es", "ru"].includes(locale) ? `/${locale}` : "/es";
    return NextResponse.redirect(new URL(`${prefix}/dashboard`, request.url));
  }

  // 3. Handle Internationalization
  const handleI18n = createMiddleware({
    locales,
    defaultLocale,
  });

  const response = handleI18n(request);

  // 4. Merge cookies from Supabase response into the final response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}

export const config = {
  matcher: ["/", "/(ru|en|es)/:path*", "/dashboard/:path*", "/login"],
};
