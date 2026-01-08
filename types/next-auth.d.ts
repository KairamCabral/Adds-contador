import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      companies: Array<{
        companyId: string;
        role: Role;
      }>;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    companies?: Array<{
      companyId: string;
      role: Role;
    }>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    name?: string | null;
    companies?: Array<{
      companyId: string;
      role: Role;
    }>;
  }
}

