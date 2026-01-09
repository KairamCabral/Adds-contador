"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-900/40"
      type="button"
    >
      Desconectar
    </button>
  );
}

