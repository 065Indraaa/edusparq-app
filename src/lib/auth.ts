import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Self-hosted (Wasmer/Docker/proxy): trust the X-Forwarded-* headers so Auth.js
  // can resolve the host. Without this, production throws `UntrustedHost`, which
  // surfaces as a generic Internal Server Error on login/register.
  trustHost: true,

  // JWT sessions: the user id is carried in the token, so verifying a session does
  // NOT require a DB round-trip on every request (more resilient when the DB is slow
  // or briefly unreachable from the host).
  session: { strategy: "jwt" },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password as string, user.password);
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Auto-provision a User document for first-time Google sign-ins.
      // Wrapped defensively: a transient DB error must not 500 the whole login.
      if (account?.provider === "google") {
        try {
          await connectDB();
          const existing = await User.findOne({ email: user.email });
          if (!existing) {
            await User.create({
              name: user.name,
              email: user.email,
              image: user.image,
            });
          }
        } catch (err) {
          console.error("[auth] signIn provisioning failed:", err);
          // Allow the sign-in to proceed; the user row can be reconciled later.
        }
      }
      return true;
    },

    // Persist a stable user id into the JWT once, then reuse it on every call.
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      // For Google users, resolve the DB id once (when not yet set) so API routes
      // that key off session.user.id work. Best-effort; never throws.
      if (!token.id && token.email) {
        try {
          await connectDB();
          const dbUser = await User.findOne({ email: token.email });
          if (dbUser) token.id = dbUser._id.toString();
        } catch (err) {
          console.error("[auth] jwt id resolution failed:", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
});
