import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const CLIENT_ROLES = new Set(['authorized', 'admin']);

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // Admin sub-routes: only admin role
    if (pathname.startsWith('/admin/') && role !== 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // Client-only routes: authorized or admin
    const clientRoutes = ['/cartera', '/accions', '/informe-bursatil', '/client/'];
    for (const route of clientRoutes) {
      if (pathname.startsWith(route) && !CLIENT_ROLES.has(role ?? '')) {
        return NextResponse.redirect(new URL('/acces-restringit', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Always public
        if (
          pathname === '/' ||
          pathname === '/login' ||
          pathname === '/admin' ||
          pathname.startsWith('/noticies') ||
          pathname.startsWith('/comparador') ||
          pathname.startsWith('/acces-restringit') ||
          pathname.startsWith('/api/noticies') ||
          pathname.startsWith('/api/fons') ||
          pathname.startsWith('/api/newsletter/subscribe')
        ) return true;

        // Require valid session
        if (pathname.startsWith('/admin/'))             return !!token;
        if (pathname.startsWith('/cartera'))            return !!token;
        if (pathname.startsWith('/accions'))            return !!token;
        if (pathname.startsWith('/informe-bursatil'))   return !!token;
        if (pathname.startsWith('/client/'))            return !!token;
        if (pathname.startsWith('/api/admin/'))         return !!token;
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
    '/admin/:path*',
    '/cartera/:path*',
    '/accions/:path*',
    '/accions',
    '/informe-bursatil',
    '/informe-bursatil/:path*',
    '/client/:path*',
    '/api/admin/:path*',
    '/api/portfolios/:path*',
    '/api/stocks/:path*',
    '/api/stocks',
    '/api/market-data/:path*',
    '/api/market-data',
    '/api/stock-analysis',
  ],
};
