import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // Rutes d'admin: requereixen rol admin
    if (pathname.startsWith('/admin') && pathname !== '/admin' && role !== 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // Rutes de cartera pròpia: requereixen rol authorized o admin
    if (pathname.startsWith('/cartera') && role !== 'authorized' && role !== 'admin') {
      return NextResponse.redirect(new URL('/acces-restringit', req.url));
    }

    // Accions: requereixen rol authorized o admin
    if (pathname.startsWith('/accions') && role !== 'authorized' && role !== 'admin') {
      return NextResponse.redirect(new URL('/acces-restringit', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Rutes públiques: sempre permeses
        if (
          pathname === '/' ||
          pathname.startsWith('/noticies') ||
          pathname.startsWith('/comparador') ||
          pathname.startsWith('/api/noticies') ||
          pathname.startsWith('/api/fons') ||
          pathname.startsWith('/api/newsletter/subscribe') ||
          pathname.startsWith('/acces-restringit')
        ) {
          return true;
        }

        // /admin (pàgina de login): permesa sempre
        if (pathname === '/admin') return true;

        // Resta de /admin/*: requereix token
        if (pathname.startsWith('/admin/')) return !!token;

        // /cartera: requereix token (pública mostra teaser)
        if (pathname.startsWith('/cartera')) return !!token;

        // /accions: requereix token (pública mostra teaser)
        if (pathname.startsWith('/accions')) return !!token;

        // /api/portfolios: requereix token
        if (pathname.startsWith('/api/portfolios')) return !!token;

        // /api/stocks: requereix token
        if (pathname.startsWith('/api/stocks')) return !!token;
        if (pathname.startsWith('/api/market-data')) return !!token;

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/cartera/:path*',
    '/accions/:path*',
    '/accions',
    '/api/admin/:path*',
    '/api/portfolios/:path*',
    '/api/stocks/:path*',
    '/api/stocks',
    '/api/market-data/:path*',
    '/api/market-data',
  ],
};
