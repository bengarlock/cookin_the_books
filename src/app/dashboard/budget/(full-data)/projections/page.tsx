import type { Metadata } from "next";

import { ProjectionsDashboard } from "@/components/projections-dashboard";

export const metadata: Metadata = {
  title: "Projections",
};

export default function ProjectionsPage() {
  return <ProjectionsDashboard />;
}
