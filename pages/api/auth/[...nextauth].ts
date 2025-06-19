// pages/api/auth/[...nextauth].ts
import NextAuth, { DefaultSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
    }
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.role = session.user.email === 'aashishkumar1812@gmail.com' ? 'admin' : 'user';
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
export default handler;

// This file configures NextAuth.js authentication for your Next.js app.
// It sets up Google as an authentication provider and defines how user sessions are handled.
// The session callback assigns a "role" (admin/user) based on the user's email.
// This API route is required for NextAuth to work and is automatically used by the NextAuth client.
