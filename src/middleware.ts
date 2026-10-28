import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isLocalNoAuth } from '@/lib/auth/local-mode';

// Protege el admin y mantiene viva la sesión de Supabase (admins y cuentas de compradores).
// La contraseña para comprar (que se prende y apaga desde /admin/config) la chequea la
// página /entradas con hasGateAccess(), porque el middleware no puede saber si está prendida
// sin consultar la base. Las páginas de /cuenta piden la sesión ellas mismas.
const ADMIN_PUBLIC = ['/admin/login'];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string) {
  return matchesPrefix(pathname, ['/admin', '/api/admin']);
}

// Refresca el token de Supabase si venció y propaga las cookies nuevas en la respuesta.
async function refreshSession(request: NextRequest) {
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

  return { user, response };
}

async function handleAdminAuth(request: NextRequest): Promise<NextResponse> {
  if (matchesPrefix(request.nextUrl.pathname, ADMIN_PUBLIC)) {
    return NextResponse.next();
  }

  // Esto solo pide un usuario logueado: que sea admin (fila activa en `admins`) lo
  // chequean el layout del panel y cada acción (src/lib/auth/admin.ts). Así una cuenta
  // de comprador no entra.
  const { user, response } = await refreshSession(request);
  if (!user) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    // Modo local sin claves (src/lib/auth/local-mode.ts): el admin no pide login.
    if (isLocalNoAuth()) {
      if (pathname === '/admin/login') return NextResponse.redirect(new URL('/admin', request.url));
      return NextResponse.next();
    }
    return handleAdminAuth(request);
  }

  // /cuenta, /entradas, /compra/resultado y /barra: las cuentas de compradores andan igual en modo local.
  const { response } = await refreshSession(request);
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/cuenta/:path*', '/entradas', '/compra/resultado', '/barra/:path*'],
};
