"use client";

import { PageHeader } from "@/components/dashboard/dashboard-ui";
import { AdvisoryAnnouncements } from "@/components/dashboard/advisory-announcements";

export default function AdminAdvisoryAnnouncementsPage() {
  return (
    <>
      <PageHeader
        title="Advisory Announcements"
        subtitle="Browse posts from advisory teachers to their sections. View-only."
      />
      <AdvisoryAnnouncements />
    </>
  );
}
