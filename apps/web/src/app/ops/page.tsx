import { redirect } from "next/navigation";
import { getOpsSession } from "@/lib/ops-auth";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login");
  return <Dashboard user={session} />;
}
