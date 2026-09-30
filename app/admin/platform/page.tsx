import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import PlatformOrgsClient from "./platform-orgs-client";

export default async function PlatformPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email)) redirect("/admin");
  return <PlatformOrgsClient />;
}
