"use client";

import { LayoutDashboard, Megaphone, Users, UserCheck, GraduationCap, Settings, BookOpen, CalendarOff, UserCircle, ClipboardList } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const NAV = [
  { label: "Dashboard",               href: "/admin",                        icon: LayoutDashboard },
  { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
  {
    label: "Users",
    icon: Users,
    collapsible: true,
    children: [
      { label: "Employees", href: "/admin/users/employees", icon: UserCheck },
      { label: "Students",  href: "/admin/users/students",  icon: GraduationCap },
    ],
  },
  { label: "Teacher Attendance",   href: "/admin/teacher-attendance",   icon: ClipboardList  },
  { label: "Sections",             href: "/admin/sections",             icon: BookOpen       },
  { label: "School Calendar",      href: "/admin/calendar",             icon: CalendarOff    },
  { label: "Settings",             href: "/admin/settings",             icon: Settings       },
  { label: "My Profile",           href: "/admin/profile",              icon: UserCircle     },
];

export default function AdminLayout({ children }) {
  return (
    <DashboardShell role="admin" navItems={NAV}>
      {children}
    </DashboardShell>
  );
}
