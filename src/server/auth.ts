import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { cancelDeletion, withinGracePeriod } from "@/server/services/account-deletion";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // La sesión dura 1 año: solo se cierra si el usuario pulsa "Cerrar sesión" en Ajustes
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;
        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Borrado pendiente: entrar dentro del plazo lo cancela y el perfil
        // vuelve a verse en sus grupos tal y como estaba. Pasado el plazo la
        // cuenta ya no sirve, aunque el barrido aún no la haya eliminado.
        if (user.deletionRequestedAt) {
          if (!withinGracePeriod(user.deletionRequestedAt)) return null;
          await cancelDeletion(db, user.id);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
