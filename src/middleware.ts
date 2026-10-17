import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { GATE_COOKIE, GATE_TTL_SECONDS, type GateSession } from '@/lib/auth/gate-shared';

// La landing es pública. La contraseña protege solo la compra de entradas.
const GATED_PREFIXES = ['/entradas', '/checkout'];
const ADMIN_PUBLIC = ['/admin/login'];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string) {
  return matchesPrefix(pathname, ['/admin', '/api/admin']);
}

async function handleAdminAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (matchesPrefix(pathname, ADMIN_PUBLIC)) {
    return NextResponse.next();
  }

  // Supabase middleware client — refresca tokens y propaga cookies
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return response;
}

function redirectToAccess(request: NextRequest) {
  const url = new URL('/access', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Chequeo rápido de cookie. La comparación contra la contraseña vigente (rotación)
// la hace cada página protegida con hasGateAccess().
async function handleGateAuth(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.GATE_COOKIE_SECRET;
  if (!secret || secret.length < 32) return redirectToAccess(request);

  const response = NextResponse.next();
  const session = await getIronSession<GateSession>(request, response, {
    cookieName: GATE_COOKIE,
    password: secret,
    ttl: GATE_TTL_SECONDS,
  });

  if (!session.granted) return redirectToAccess(request);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) return handleAdminAuth(request);
  if (matchesPrefix(pathname, GATED_PREFIXES)) return handleGateAuth(request);
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/entradas/:path*', '/checkout/:path*'],
};
