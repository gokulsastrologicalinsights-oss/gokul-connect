import { NextRequest, NextResponse } from "next/server";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getUserNotificationPreferencesDb,
  updateUserNotificationPreferencesDb,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params;
    const { business, user } = await validateBusinessAccess(businessSlug);

    const preferences = await getUserNotificationPreferencesDb(business.id, user.id);
    return NextResponse.json({ success: true, preferences });
  } catch (err: any) {
    const message = err?.message || "Failed to load preferences";
    const status = message.includes("unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  try {
    const { businessSlug } = await params;
    const { business, user } = await validateBusinessAccess(businessSlug);

    const body = await request.json().catch(() => ({}));
    const updated = await updateUserNotificationPreferencesDb(business.id, user.id, body);

    return NextResponse.json({ success: true, preferences: updated });
  } catch (err: any) {
    const message = err?.message || "Failed to update preferences";
    const status = message.includes("unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
