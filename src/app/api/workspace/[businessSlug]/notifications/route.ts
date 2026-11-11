import { NextRequest, NextResponse } from "next/server";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  dismissAllNotificationsDb,
  generateFollowUpRemindersDb,
  getNotificationStatsDb,
  listNotificationsDb,
  markAllNotificationsReadDb,
} from "@/lib/notifications/service";
import { NotificationFilterOptions } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params;
    const { business, user } = await validateBusinessAccess(businessSlug);

    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get("statsOnly") === "true";

    if (statsOnly) {
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: true, stats });
    }

    const filters: NotificationFilterOptions = {
      tab: (searchParams.get("tab") as any) || "all",
      category: (searchParams.get("category") as any) || undefined,
      includeDismissed: searchParams.get("includeDismissed") === "true",
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20,
    };

    const [listResult, stats] = await Promise.all([
      listNotificationsDb(business.id, user.id, filters),
      getNotificationStatsDb(business.id, user.id),
    ]);

    return NextResponse.json({
      success: true,
      ...listResult,
      stats,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to load notifications";
    const status = message.includes("unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params;
    const { business, user } = await validateBusinessAccess(businessSlug);

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "mark_all_read") {
      const updatedCount = await markAllNotificationsReadDb(business.id, user.id);
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: true, updatedCount, stats });
    }

    if (action === "dismiss_all") {
      const dismissedCount = await dismissAllNotificationsDb(business.id, user.id);
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: true, dismissedCount, stats });
    }

    if (action === "generate_reminders") {
      const result = await generateFollowUpRemindersDb(business.id);
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: true, ...result, stats });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: mark_all_read, dismiss_all, generate_reminders" },
      { status: 400 }
    );
  } catch (err: any) {
    const message = err?.message || "Action failed";
    const status = message.includes("unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
