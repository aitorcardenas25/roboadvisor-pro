import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const SELF          = "'self'";
const UNSAFE_INLINE = "'unsafe-inline'";
const UNSAFE_EVAL   = "'unsafe-eval'";  // required by Next.js in dev

const EXTERNAL_APIS = [
  'https://data-api.ecb.europa.eu',
  'https://financialmodelingprep.com',
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
  'https://api.resend.com',
].join(' ');

const csp = [
  `default-src ${SELF}`,
  `script-src ${SELF} ${UNSAFE_EVAL} ${UNSAFE_INLINE}`,
  `style-src ${SELF} ${UNSAFE_INLINE}`,
  `img-src ${SELF} data: blob:`,
  `font-src ${SELF} data:`,
  `connect-src ${SELF} ${EXTERNAL_APIS}`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri ${SELF}`,
  `form-action ${SELF}`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: csp },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withBundleAnalyzer(nextConfig);
