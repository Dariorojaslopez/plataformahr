import type { Metadata } from "next";
import { PublicOfferLetterSignPage } from "@/components/ats/public-offer-letter-sign-page";

export const metadata: Metadata = {
  title: "Firmar carta oferta",
  description: "Revisa y firma tu carta oferta.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicOfferLetterSignPage token={token} />;
}
