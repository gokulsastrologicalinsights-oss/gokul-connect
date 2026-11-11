import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getCrmContactsAction,
  getCrmDashboardMetricsAction,
  getCrmCategoriesAction,
  getCrmSegmentsAction,
  getLifecycleStagesAction,
} from "@/app/actions/crm";
import { CrmClient } from "@/components/crm/CrmClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM & Contact Management | Gokul Connect",
  description: "Multi-tenant CRM, contact profiling, business categorization, notes, and segmentation.",
};

export default async function CrmPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  // Fetch initial CRM data in parallel
  const [contactsRes, metricsRes, categoriesRes, segmentsRes, stagesRes] = await Promise.all([
    getCrmContactsAction(businessSlug, { limit: 20, page: 1 }),
    getCrmDashboardMetricsAction(businessSlug),
    getCrmCategoriesAction(businessSlug),
    getCrmSegmentsAction(businessSlug),
    getLifecycleStagesAction(businessSlug),
  ]);

  const initialContacts = contactsRes.success ? contactsRes.contacts : [];
  const initialTotalCount = contactsRes.success ? contactsRes.totalCount : 0;
  const initialMetrics = metricsRes.success ? metricsRes.metrics : {
    totalContacts: initialContacts.length,
    leads: 0,
    activeCustomers: 0,
    inactive: 0,
    optedOut: 0,
    newThisMonth: 0,
  };
  const categories = categoriesRes.success ? categoriesRes.categories : [];
  const initialSegments = segmentsRes.success ? segmentsRes.segments : [];
  const stages = stagesRes.success ? stagesRes.stages : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {business.name} — Customer CRM
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage contacts, customer categories, notes, saved segments, and WhatsApp engagement history with complete business separation.
        </p>
      </div>

      <CrmClient
        business={business}
        initialContacts={initialContacts}
        initialTotalCount={initialTotalCount}
        initialMetrics={initialMetrics}
        categories={categories}
        initialSegments={initialSegments}
        stages={stages}
      />
    </div>
  );
}
