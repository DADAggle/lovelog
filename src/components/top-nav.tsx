"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/happy", label: "Happy" },
  { href: "/chat", label: "Chat" },
  { href: "/export", label: "Export" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      <ul className="flex items-center gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-900 font-semibold text-white underline underline-offset-4"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
