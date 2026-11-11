import { NextRequest, NextResponse } from "next/server";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  dismissNotificationDb,
  getNotificationStatsDb,
  markNotificationReadDb,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ businessSlug: string; notificationId: string }>;
  }
) {
  try {
    const { businessSlug, notificationId } = await params;
    const { business, user } = await validateBusinessAccess(businessSlug);

    const body = await request.json().catch(() => ({}));
    const action = body.action || "mark_read";

    if (action === "dismiss") {
      const ok = await dismissNotificationDb(business.id, notificationId, user.id);
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: ok, stats });
    }

    if (action === "mark_read") {
      const ok = await markNotificationReadDb(business.id, notificationId, user.id);
      const stats = await getNotificationStatsDb(business.id, user.id);
      return NextResponse.json({ success: ok, stats });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: mark_read, dismiss" },
      { status: 400 }
    );
  } catch (err: any) {
    const message = err?.message || "Operation failed";
    const status = message.includes("unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
