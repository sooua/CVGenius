import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/resume",
  "/account",
  "/upload",
  "/billing",
  "/applications",
];
const AUTH_ONLY_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getUser() triggers token refresh and writes the new cookie via setAll.
  // Must run before any response is committed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => path.startsWith(p));
  const isMfa = path.startsWith("/mfa");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Two-factor gate: a user with a verified factor whose current session is
  // only aal1 must clear the /mfa challenge before reaching protected pages.
  if (user && (isProtected || isMfa)) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

    if (needsMfa && !isMfa) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      url.search = "";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    // Already satisfied (or no factor) — don't strand the user on /mfa.
    if (!needsMfa && isMfa) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // /mfa requires a session.
  if (isMfa && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", "/dashboard");
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
