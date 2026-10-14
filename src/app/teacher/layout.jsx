"use client";

import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  UserCheck,
  UserCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const NAV = [
  {
    heading: "Home",
    items: [
      { label: "Dashboard",       href: "/teacher",         icon: LayoutDashboard },
    ],
  },
  {
    heading: "Attendance",
    items: [
      { label: "Attendance", href: "/teacher/attendance", icon: ClipboardList },
      { label: "Schedule", href: "/teacher/schedule", icon: CalendarDays },
    ],
  },
  {
    heading: "Students",
    items: [
      { label: "Student Status", href: "/teacher/learners", icon: UserCheck },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "My Profile", href: "/teacher/profile", icon: UserCircle },
    ],
  },
];

export default function TeacherLayout({ children }) {
  return (
    <DashboardShell role="teacher" navItems={NAV}>
      {children}
    </DashboardShell>
  );
}
