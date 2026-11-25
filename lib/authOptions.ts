import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByCredentials, getTotpSecret } from './users';
import { decryptSecret, verifyTotp, consumeStep } from './totp';
import { TWO_FACTOR_REQUIRED, TWO_FACTOR_WRONG, TOO_MANY_ATTEMPTS } from './authMessages';
import { logAuditEvent } from './auditLog';
import { recordActivity } from './betaActivity';
import { rateLimit } from './rateLimiter';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuari', type: 'text' },
        password: { label: 'Contrasenya', type: 'password' },
        code:     { label: 'Codi de verificació', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;
        // Frena els intents d'endevinar contrasenyes: 10 per usuari i 30 per adreça IP cada 15 minuts.
        // (Comptador en memòria de cada instància: limita, però no substitueix una contrasenya forta.)
        const fwd = (req?.headers as Record<string, string | undefined> | undefined)?.['x-forwarded-for'];
        const ip = fwd?.split(',')[0]?.trim() || 'unknown';
        const login = credentials.username.trim().toLowerCase();
        const byUser = rateLimit(`login-user:${login}`, 10, 15 * 60_000);
        const byIp   = rateLimit(`login-ip:${ip}`, 30, 15 * 60_000);
        if (!byUser.ok || !byIp.ok) throw new Error(TOO_MANY_ATTEMPTS);
        const user = await findUserByCredentials(credentials.username.trim(), credentials.password);
        if (!user) return null;
        // Verificació en dos passos (només admin, si l'ha activada). ADMIN_2FA_DISABLE=true és la
        // sortida d'emergència si perd el mòbil (es posa a Vercel, que té la seva pròpia verificació).
        if (user.role === 'admin' && process.env.ADMIN_2FA_DISABLE !== 'true') {
          const stored = await getTotpSecret(user.id);
          const secret = stored ? decryptSecret(stored) : null;
          if (secret) {
            if (!credentials.code) throw new Error(TWO_FACTOR_REQUIRED);
            const step = verifyTotp(secret, credentials.code);
            if (step === null || !consumeStep(user.id, step)) throw new Error(TWO_FACTOR_WRONG);
          }
        }
        logAuditEvent('auth.login', { userId: user.id, userEmail: user.email });
        if (user.role === 'client') recordActivity(user.id, 'login');
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }) {
      session.user.id   = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  pages:  { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
