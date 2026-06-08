import { redirect } from "next/navigation";
import { getOpsSession } from "@/lib/ops-auth";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function OpsUsersPage() {
  const session = await getOpsSession();
  if (!session) redirect("/ops/login");
  if (session.role !== "admin") redirect("/ops");
  return <UsersManager />;
}
