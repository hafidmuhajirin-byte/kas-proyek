import { AppShell } from "@/components/AppShell";
import { MandorShell } from "@/components/MandorShell";
import { isMandorLike, requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();

  if (isMandorLike(user)) {
    return <MandorShell user={user}>{children}</MandorShell>;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
