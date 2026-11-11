import { redirect } from "next/navigation";

export default async function CustomersRedirectPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  redirect(`/workspace/${businessSlug}/crm`);
}
