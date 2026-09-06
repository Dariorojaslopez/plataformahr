import { AtsSettingsShell } from "@/components/ats/ats-settings-shell";

export default function AtsSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AtsSettingsShell>{children}</AtsSettingsShell>;
}
