import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const CLIENT_PATHS = ['/client'];
const ADMIN_PATHS  = ['/admin'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isClientRoute = CLIENT_PATHS.some(p => pathname.startsWith(p));
  const isAdminRoute  = ADMIN_PATHS.some(p => pathname.startsWith(p));

  if (!isClientRoute && !isAdminRoute) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && token.role !== 'admin') {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/client/:path*', '/admin/:path*'],
};
