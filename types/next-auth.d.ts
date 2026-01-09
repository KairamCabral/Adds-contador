import { Role } from "@prisma/client";

export interface RoleAssignment {
  companyId: string;
  role: Role;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      companies: Array<RoleAssignment>;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    companies?: Array<RoleAssignment>;
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

