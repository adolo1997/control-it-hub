"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { credentials: "same-origin", method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="logout-button" onClick={logout} type="button">
      <LogOut size={18} />
      Salir
    </button>
  );
}
