import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import PortalHeader from "../PortalHeader";
import NewRequestForm from "./NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  return (
    <>
      <PortalHeader authed />
      <NewRequestForm />
    </>
  );
}
