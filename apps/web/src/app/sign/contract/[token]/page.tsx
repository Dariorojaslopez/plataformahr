import type { Metadata } from "next";
import { PublicContractSignPage } from "@/components/ats/public-contract-sign-page";

export const metadata: Metadata = {
  title: "Firmar contrato",
  description: "Revisa y firma tu contrato.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicContractSignPage token={token} />;
}
