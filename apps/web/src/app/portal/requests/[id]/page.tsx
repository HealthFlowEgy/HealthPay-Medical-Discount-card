import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import PortalHeader from "../../PortalHeader";
import RequestDetail from "./RequestDetail";

export const dynamic = "force-dynamic";

export default async function PortalRequestPage({ params }: { params: { id: string } }) {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  return (
    <>
      <PortalHeader authed />
      <RequestDetail id={params.id} />
    </>
  );
}
