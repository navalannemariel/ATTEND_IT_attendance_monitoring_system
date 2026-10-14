"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LogOut,
  Loader2,
  Menu,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ROLE_LABELS, ROLE_HOME } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LiveDateTime } from "@/components/dashboard/live-datetime";

const COLLAPSE_KEY = "hhca:sidebar-collapsed";

// Subtle "move" on the icon when you hover or press a nav item.
const ICON_ANIM =
  "transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-0.5 group-active:scale-90";

/**
 * Shared chrome for every role's dashboard — a soft, light theme with the
 * school's maroon used as the accent (active nav, icons, avatar).
 * Props:
 *  - role: the role this section requires (guards against cross-role access)
 *  - navItems: either a flat list of links — [{ label, href, icon }] — or a
 *    grouped list with section headings:
 *      [{ heading, items: [
 *         { label, href, icon, dot? },                         // plain link
 *         { label, icon, dot?, collapsible: true, children },  // collapsible
 *      ] }]
 *    A `dot` ("green" | "blue") draws a small status indicator on the item.
 *  - children
 */
export function DashboardShell({ role, navItems, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which collapsible groups are closed (keyed by label). Default: open.
  const [closedGroups, setClosedGroups] = useState({});
  // Desktop rail collapse — manual only, remembered across sessions. Safe to
  // read storage in the initializer: the shell renders a loader (not the
  // sidebar) on the first render while auth is loading, so no SSR mismatch.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Normalize a flat `navItems` array into a single unlabeled section so the
  // renderer only has to deal with the grouped shape.
  const sections =
    Array.isArray(navItems) && navItems[0]?.items
      ? navItems
      : [{ items: navItems ?? [] }];

  const isActive = (href) =>
    pathname === href || (href !== ROLE_HOME[role] && pathname.startsWith(href));

  // Guard: must be logged in AND match this section's role.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role !== role) {
      router.replace(ROLE_HOME[user.role] ?? "/login");
    }
  }, [loading, user, role, router]);

  // Close the mobile drawer on navigation.
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // `rail` = collapsed icon-only mode (desktop). `showToggle` hides the
  // collapse control inside the mobile drawer, where it doesn't apply.
  const renderSidebar = ({ rail, showToggle }) => (
    <div className="flex h-full flex-col">
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-5",
          rail && "flex-col gap-3 px-0"
        )}
      >
        <Image
          src="/hhca-logo.jpg"
          alt="HHCA logo"
          width={40}
          height={40}
          className="rounded-full ring-2 ring-primary/15"
          priority
        />
        {!rail && (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">HHCA Attendance</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
        )}
        {showToggle && !rail && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="group ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <PanelLeftClose className={cn("size-5", ICON_ANIM)} />
          </button>
        )}
      </div>

      {showToggle && rail && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="group rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <PanelLeftOpen className={cn("size-5", ICON_ANIM)} />
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {sections.map((section, si) => (
          <div key={section.heading ?? si} className="space-y-1">
            {section.heading && !rail && (
              <p className="px-3.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.heading}
              </p>
            )}
            {section.items.map((item) =>
              item.collapsible ? (
                <CollapsibleGroup
                  key={item.label}
                  item={item}
                  rail={rail}
                  open={!closedGroups[item.label]}
                  onToggle={() =>
                    setClosedGroups((prev) => ({
                      ...prev,
                      [item.label]: !prev[item.label],
                    }))
                  }
                  onExpandRail={() => setCollapsed(false)}
                  isActive={isActive}
                />
              ) : (
                <NavLink
                  key={item.href}
                  item={item}
                  rail={rail}
                  active={isActive(item.href)}
                />
              )
            )}
          </div>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-4">
        {/* User identity — links to profile, collapses to avatar in rail mode */}
        <Link
          href={`/${role}/profile`}
          title={rail ? user.name : undefined}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-slate-100",
            rail && "justify-center px-0"
          )}
        >
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              className="size-8 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-rose-700 text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
          )}
          {!rail && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              {role === "teacher" && user.sectionName && (
                <p className="truncate text-xs font-medium text-primary">
                  {[user.sectionGrade, user.sectionName].filter(Boolean).join(" – ")}
                </p>
              )}
            </div>
          )}
        </Link>

        <div className="border-t border-slate-100" />

        <button
          type="button"
          onClick={handleLogout}
          title={rail ? "Logout" : undefined}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-destructive/10 hover:text-destructive",
            rail && "justify-center px-0"
          )}
        >
          <LogOut className={cn("size-5", ICON_ANIM)} />
          {!rail && "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FCF7F8] to-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/70 bg-white transition-all duration-300 ease-in-out lg:block",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {renderSidebar({ rail: collapsed, showToggle: true })}
      </aside>

      {/* Mobile drawer (always full, never railed) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 text-slate-400 hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            {renderSidebar({ rail: false, showToggle: false })}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className={cn("transition-all duration-300 ease-in-out", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-muted-foreground hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <LiveDateTime className="hidden text-xs text-muted-foreground sm:block" />

          <div className="ml-auto flex items-center gap-3">
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Small status indicator dot for a nav item. */
function Dot({ tone }) {
  if (!tone) return null;
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        tone === "green" ? "bg-emerald-500" : "bg-sky-500"
      )}
    />
  );
}

/** A single navigation link. */
function NavLink({ item, active, rail }) {
  const { label, href, icon: Icon, dot, badge } = item;
  return (
    <Link
      href={href}
      title={rail ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        rail && "justify-center px-0",
        active
          ? "bg-primary/10 text-primary"
          : "text-slate-600 hover:bg-slate-100 hover:text-foreground"
      )}
    >
      {Icon && <Icon className={cn("size-5 shrink-0", ICON_ANIM, active && "text-primary")} />}
      {!rail && <span className="flex-1">{label}</span>}
      {!rail && <Dot tone={dot} />}
      {!rail && badge != null && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/** An expandable group of sub-links (e.g. Homeroom Subjects). */
function CollapsibleGroup({ item, open, onToggle, onExpandRail, isActive, rail }) {
  const { label, icon: Icon, dot, children = [] } = item;
  const anyChildActive = children.some((c) => isActive(c.href));

  // In rail mode the group becomes a single icon button; clicking expands the
  // sidebar so the sub-links become reachable.
  if (rail) {
    return (
      <button
        type="button"
        onClick={onExpandRail}
        title={label}
        className={cn(
          "group flex w-full items-center justify-center rounded-xl px-0 py-2.5 text-sm font-medium transition-colors",
          anyChildActive
            ? "bg-primary/10 text-primary"
            : "text-slate-600 hover:bg-slate-100 hover:text-foreground"
        )}
      >
        {Icon && <Icon className={cn("size-5 shrink-0", ICON_ANIM, anyChildActive && "text-primary")} />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        open && "bg-slate-50/80 ring-1 ring-slate-200/70"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
          anyChildActive
            ? "text-primary"
            : "text-slate-600 hover:bg-slate-100 hover:text-foreground"
        )}
      >
        <Dot tone={dot} />
        {Icon && <Icon className={cn("size-5", ICON_ANIM, anyChildActive && "text-primary")} />}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-1 px-2 pb-2">
          {children.map((child) => {
            const active = isActive(child.href);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-white hover:text-foreground"
                )}
              >
                {ChildIcon && (
                  <ChildIcon className={cn("size-4", ICON_ANIM, active && "text-primary")} />
                )}
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
