import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type RoleAssignment = {
  companyId: string;
  role: Role;
};

export const authConfig = {
  session: { strategy: "jwt" as const },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            roles: true,
          },
        });

        if (!user || !user.active) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        const companies: RoleAssignment[] = user.roles.map((r) => ({
          companyId: r.companyId,
          role: r.role,
        }));

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          companies,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        const typedUser = user as {
          id: string;
          email: string;
          name?: string;
          companies?: RoleAssignment[];
        };
        token.id = typedUser.id;
        token.email = typedUser.email;
        token.name = typedUser.name;
        token.companies = typedUser.companies ?? [];
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user = {
        id: token.id as string,
        email: token.email as string,
        name: (token.name as string) ?? null,
        companies: (token.companies as RoleAssignment[]) ?? [],
      };
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

