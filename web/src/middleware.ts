// web/src/middleware.ts
// Next.js Edge Middleware — protege rotas e redireciona por role
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/health'];
const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rotas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Obter token do cookie httpOnly (definido pelo backend)
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return redirectToLogin(request);
  }

  try {
    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const role = payload.role as string;

    // Redirecionar para área correta conforme role
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(
        new URL(role === 'ADMIN' ? '/admin/dashboard' : '/patient/cardapio', request.url),
      );
    }

    // Bloquear acesso cruzado entre roles
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/patient/cardapio', request.url));
    }

    if (pathname.startsWith('/patient') && role !== 'PATIENT') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Adicionar headers de segurança
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );

    return response;
  } catch {
    // Token inválido ou expirado — tentar refresh
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const url = new URL('/login', request.url);
  url.searchParams.set('from', request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  // Limpar cookies corrompidos
  response.cookies.delete('access_token');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
