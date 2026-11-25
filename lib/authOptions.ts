import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByCredentials } from './users';
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
        if (!byUser.ok || !byIp.ok) throw new Error('Massa intents. Espera 15 minuts i torna-ho a provar.');
        const user = await findUserByCredentials(credentials.username.trim(), credentials.password);
        if (!user) return null;
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
