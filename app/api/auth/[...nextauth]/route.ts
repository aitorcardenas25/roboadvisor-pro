import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuari', type: 'text' },
        password: { label: 'Contrasenya', type: 'password' },
      },
      async authorize(credentials) {
        const validUser     = process.env.ADMIN_USERNAME ?? 'admin';
        const validPassword = process.env.ADMIN_PASSWORD ?? 'factorOTC2024!';

        if (
          credentials?.username === validUser &&
          credentials?.password === validPassword
        ) {
          return {
            id:    '1',
            name:  'Admin Factor OTC',
            email: 'admin@factorotc.com',
            role:  'admin',
          };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 hores
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
