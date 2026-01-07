import { Role } from "@/lib/generated/prisma";
import { Session } from "next-auth";

export type RoleCheck = Role | Role[];

const normalizeRoles = (roles: RoleCheck): Role[] =>
  Array.isArray(roles) ? roles : [roles];

export function userHasRole(
  session: Session | null,
  roles: RoleCheck,
  companyId?: string,
): boolean {
  if (!session?.user?.companies?.length) return false;
  const allowed = normalizeRoles(roles);
  return session.user.companies.some(
    (c) => allowed.includes(c.role) && (!companyId || c.companyId === companyId),
  );
}

export function requireRole(
  session: Session | null,
  roles: RoleCheck,
  companyId?: string,
): asserts session is Session {
  if (!session || !userHasRole(session, roles, companyId)) {
    throw new Error("Acesso negado");
  }
}

