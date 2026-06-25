import { redirect } from "next/navigation";
import { getOpsSession, roleAtLeast } from "@/lib/ops-auth";
import PartnersManager from "./PartnersManager";

export const dynamic = "force-dynamic";

export default async function OpsPartnersPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login");
  // Partner key management is restricted to super-admins.
  if (!roleAtLeast(session.role, "super_admin")) redirect("/ops");
  return <PartnersManager />;
}
