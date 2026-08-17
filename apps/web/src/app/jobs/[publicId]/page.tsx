import type { Metadata } from "next";
import { PublicJobPage } from "@/components/ats/public-job-page";

export const metadata: Metadata = {
  title: "Vacante",
  description: "Conoce esta oportunidad laboral y envía tu postulación.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <PublicJobPage publicId={publicId} />;
}
