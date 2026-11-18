import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { SHOW_NON_BETA_FEATURES, isNonBetaPage } from '@/lib/featureFlags';

const CLIENT_ROLES = new Set(['client', 'admin']);

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // Beta tancada: les pàgines que no en formen part no es mostren als clients
    // ni als visitants (l'admin sí que les pot obrir per revisar-les).
    if (!SHOW_NON_BETA_FEATURES && isNonBetaPage(pathname) && role !== 'admin') {
      const target = role === 'client' ? '/client/patrimoni' : '/';
      return NextResponse.redirect(new URL(target, req.url));
    }

    // Admin sub-routes: only admin role
    if (pathname.startsWith('/admin/') && role !== 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // Client-only routes: client or admin
    const clientRoutes = ['/client/patrimoni', '/client/cartera', '/client/finances', '/client/seguiment-accions'];
    for (const route of clientRoutes) {
      if (pathname.startsWith(route) && !CLIENT_ROLES.has(role ?? '')) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Always public (visitor access)
        if (
          pathname === '/' ||
          pathname === '/login' ||
          pathname === '/admin' ||
          pathname === '/privacitat' ||
          pathname === '/cookies' ||
          pathname.startsWith('/noticies') ||
          pathname.startsWith('/comparador') ||
          pathname.startsWith('/client/carteres-model') ||
          pathname.startsWith('/acces-restringit') ||
          pathname.startsWith('/api/noticies') ||
          pathname.startsWith('/api/fons') ||
          pathname.startsWith('/api/newsletter/subscribe') ||
          pathname.startsWith('/api/leads') ||
          pathname.startsWith('/api/health') ||
          pathname.startsWith('/checkout')
        ) return true;

        // Require valid session for private areas
        if (pathname.startsWith('/admin/'))             return !!token;
        if (pathname.startsWith('/client/'))            return !!token;
        if (pathname.startsWith('/api/admin/'))         return !!token;
        if (pathname.startsWith('/api/client/'))        return !!token;
        if (pathname.startsWith('/api/portfolios'))     return !!token;
        if (pathname.startsWith('/api/stocks'))         return !!token;
        if (pathname.startsWith('/api/market-data'))    return !!token;
        if (pathname.startsWith('/api/stock-analysis')) return !!token;

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/login',
    '/comparador/:path*',
    '/informe-bursatil/:path*',
    '/noticies/:path*',
    '/accions/:path*',
    '/checkout/:path*',
    '/admin/:path*',
    '/client/:path*',
    '/api/admin/:path*',
    '/api/portfolios/:path*',
    '/api/stocks/:path*',
    '/api/stocks',
    '/api/market-data/:path*',
    '/api/market-data',
    '/api/stock-analysis',
    '/api/client/:path*',
  ],
};
