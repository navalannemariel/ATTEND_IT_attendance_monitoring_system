"use client";

import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { Announcements } from "@/components/dashboard/announcements";

export default function GuidanceAnnouncementsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Updates from the school administration."
      />
      <Announcements user={user} />
    </>
  );
}
