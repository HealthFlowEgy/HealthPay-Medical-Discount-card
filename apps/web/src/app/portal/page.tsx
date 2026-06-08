import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import PortalHeader from "./PortalHeader";
import MyRequests from "./MyRequests";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  return (
    <>
      <PortalHeader authed />
      <MyRequests clientName={session.fullName} />
    </>
  );
}
