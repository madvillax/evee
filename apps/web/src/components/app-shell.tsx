"use client";

import {
  CirclesThreePlus,
  CreditCard,
  Crosshair,
  GearSix,
  House,
  Robot,
  SignOut,
  Target,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
  activePaths?: string[];
};

const primaryLinks: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: House, exact: true },
  { href: "/dashboard/opportunities", label: "Opportunities", icon: Target },
  { href: "/dashboard/agents", label: "Copilot", icon: Robot },
  { href: "/dashboard/monitors", label: "Monitors", icon: Crosshair },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: GearSix,
    activePaths: ["/dashboard/settings", "/dashboard/business", "/dashboard/integrations"],
  },
];

const routeLabels = [
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/agents", label: "Copilot" },
  { href: "/dashboard/monitors", label: "Monitors" },
  { href: "/dashboard/business", label: "Business profile" },
  { href: "/dashboard/integrations", label: "Connections" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

function isActive(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  if (item.activePaths) return item.activePaths.some((path) => pathname.startsWith(path));
  return pathname.startsWith(item.href);
}

export function AppShell({ children, workspaceName, userName, userEmail, newOpportunityCount }: {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userEmail: string;
  newOpportunityCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const currentLabel = pathname === "/dashboard"
    ? "Overview"
    : routeLabels.find((route) => pathname.startsWith(route.href))?.label ?? "Workspace";
  const billingActive = pathname.startsWith("/dashboard/billing");

  const sidebar = (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-[var(--background)] px-3 py-4">
      <div className="flex h-10 items-center justify-between px-2.5">
        <Brand />
        <button
          type="button"
          className="grid size-8 place-items-center rounded-[8px] text-[var(--text-muted)] active:scale-[0.97] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2.5 rounded-[12px] border bg-[var(--surface)] px-3 py-3 shadow-[var(--shadow)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent)]">
          {workspaceName[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{workspaceName}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">GTM workspace</p>
        </div>
      </div>

      <nav className="mt-7" aria-label="Primary navigation">
        <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">Workspace</p>
        <div className="grid gap-1">
          {primaryLinks.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex h-10 items-center gap-3 rounded-[10px] px-3 text-xs font-medium active:scale-[0.985] ${active ? "bg-[var(--accent-soft)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"}`}
              >
                <item.icon size={16} weight={active ? "fill" : "regular"} className={active ? "text-[var(--accent)]" : "text-[var(--text-faint)] group-hover:text-[var(--text-muted)]"} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/dashboard/opportunities" && newOpportunityCount > 0 ? (
                  <span className="min-w-5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold text-[var(--accent-foreground)]" aria-label={`${newOpportunityCount} new opportunities`}>
                    {newOpportunityCount > 99 ? "99+" : newOpportunityCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto">
        <Link
          href="/dashboard/billing"
          onClick={() => setMobileOpen(false)}
          aria-current={billingActive ? "page" : undefined}
          className={`mb-3 flex h-10 items-center gap-3 rounded-[10px] px-3 text-xs font-medium active:scale-[0.985] ${billingActive ? "bg-[var(--accent-soft)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"}`}
        >
          <CreditCard size={16} weight={billingActive ? "fill" : "regular"} className={billingActive ? "text-[var(--accent)]" : "text-[var(--text-faint)]"} />
          Billing
        </Link>

        <div className="flex items-center gap-2.5 border-t px-1.5 pt-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--surface-strong)] font-mono text-[11px] font-semibold">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{userName}</p>
            <p className="truncate text-[11px] text-[var(--text-faint)]">{userEmail}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={async () => {
              const { authClient } = await import("@/lib/auth-client");
              await authClient.signOut();
              router.push("/sign-in");
              router.refresh();
            }}
            className="grid size-8 place-items-center rounded-[8px] text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--danger)] active:scale-[0.96]"
          >
            <SignOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-[100dvh] bg-[var(--background)]">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[248px]" onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 lg:pl-[248px] lg:py-2 lg:pr-2">
        <div className="min-h-[100dvh] overflow-hidden bg-[var(--surface)] lg:min-h-[calc(100dvh-16px)] lg:rounded-[16px] lg:border lg:shadow-[var(--shadow)]">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid size-8 shrink-0 place-items-center rounded-[8px] border bg-[var(--surface)] active:scale-[0.97] lg:hidden"
                aria-label="Open navigation"
              >
                <CirclesThreePlus size={16} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{currentLabel}</p>
                <p className="hidden truncate text-[11px] text-[var(--text-faint)] sm:block">{workspaceName}</p>
              </div>
            </div>
            <ThemeToggle />
          </header>
          <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
