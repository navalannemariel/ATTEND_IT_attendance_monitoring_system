"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subject management has moved into the Sections detail modal.
export default function SubjectsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/sections"); }, [router]);
  return null;
}
