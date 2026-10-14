"use client";

import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Announcements } from "@/components/dashboard/announcements";

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Post announcements for parents."
      />
      <Announcements user={user} twoColumn />
    </>
  );
}
