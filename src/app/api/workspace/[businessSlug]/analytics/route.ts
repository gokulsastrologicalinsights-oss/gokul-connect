import { NextRequest, NextResponse } from "next/server";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { resolveDateRange } from "@/lib/analytics/date-utils";
import { getBusinessAnalytics, exportAnalyticsCsv } from "@/lib/analytics/service";
import { DateRangePreset } from "@/lib/analytics/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params;

    // Strict Tenant Validation Guard
    const { business, user } = await validateBusinessAccess(businessSlug);

    const { searchParams } = new URL(request.url);
    const preset = (searchParams.get("preset") as DateRangePreset) || "7d";
    const customStart = searchParams.get("customStart") || undefined;
    const customEnd = searchParams.get("customEnd") || undefined;
    const format = searchParams.get("format"); // 'csv' or 'json'

    const dateRange = resolveDateRange(preset, customStart, customEnd);

    const analyticsData = await getBusinessAnalytics(
      business.id,
      business.slug,
      dateRange,
      { userId: user.id }
    );

    if (format === "csv") {
      const csv = exportAnalyticsCsv(analyticsData, business.name);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-${business.slug}-${preset}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(analyticsData);
  } catch (err: any) {
    const message = err?.message || "Failed to load analytics";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
