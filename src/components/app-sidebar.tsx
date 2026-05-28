import { Building2, Gauge, KeyRound, Layers3, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";

type AppSidebarProps = {
  companyName: string;
  userName: string;
  role: string;
};

export function AppSidebar({ companyName, userName, role }: AppSidebarProps) {
  const items = [
    { href: "/dashboard", label: "Panel", icon: Gauge },
    { href: "/licencias", label: "Licencias", icon: KeyRound },
    { href: "/integraciones", label: "Integraciones", icon: Layers3 },
    { href: "/registros", label: "Registros", icon: ScrollText },
    { href: "/usuarios", label: "Usuarios", icon: Users },
    { href: "/empresas", label: "Empresas", icon: Building2 },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <span>Control IT Hub</span>
      </div>
      <div className="tenant-card">
        <strong>{companyName}</strong>
        <span>{userName} - {role}</span>
      </div>
      <nav className="nav" aria-label="Principal">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={item.href} key={item.href}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
        <LogoutButton />
      </nav>
    </aside>
  );
}
