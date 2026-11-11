import { NextResponse } from "next/server";
import { checkLiveness } from "@/lib/observability/system-health";

export const dynamic = "force-dynamic";

/**
 * ==============================================================================
 * LIVENESS PROBE API: /api/health/liveness
 * ==============================================================================
 * Verifies that the Node.js application process is running and responsive.
 * Zero database overhead, instant sub-millisecond response.
 * ==============================================================================
 */
export async function GET() {
  const result = checkLiveness();
  return NextResponse.json(result, { status: 200 });
}
