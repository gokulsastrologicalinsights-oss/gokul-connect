import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { getOperationsDataAction } from "@/app/actions/operations";
import { OperationsClient } from "@/components/operations/OperationsClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations & Queue Health | Gokul Connect",
  description: "Monitor background queue workers, execution heartbeats, failure recovery, and system reliability.",
};

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  await validateBusinessAccess(businessSlug);

  const res = await getOperationsDataAction(businessSlug);

  if (!res.success || !res.data) {
    return notFound();
  }

  return <OperationsClient initialData={res.data} />;
}
