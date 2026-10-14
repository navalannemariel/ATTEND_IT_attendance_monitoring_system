"use client";

import { LayoutDashboard, GraduationCap, UserCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const NAV = [
  { label: "Dashboard",  href: "/guidance",          icon: LayoutDashboard },
  { label: "Students",   href: "/guidance/students", icon: GraduationCap   },
  { label: "My Profile", href: "/guidance/profile",  icon: UserCircle      },
];

export default function GuidanceLayout({ children }) {
  return (
    <DashboardShell role="guidance" navItems={NAV}>
      {children}
    </DashboardShell>
  );
}
