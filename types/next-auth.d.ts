import { UserRole } from '@/lib/roles';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role: UserRole;
  }
  interface Session {
    user: {
      id:    string;
      name:  string;
      email: string;
      role:  UserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:   string;
    role: UserRole;
  }
}
