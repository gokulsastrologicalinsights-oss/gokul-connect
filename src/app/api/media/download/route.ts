import { NextRequest, NextResponse } from "next/server";
import { getStoredMediaFile, verifySignedMediaToken, verifyTenantStoragePath } from "@/lib/media/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET Handler — Stream Authorized Private Media File
 *
 * Supports two secure access modes:
 * 1. HMAC Token Verification: Requires valid path, biz, exp, and sig.
 * 2. Authenticated Workspace Session: Active user session with verified membership in business tenant.
 *
 * Guarantees zero leakage of Meta access tokens or storage credentials.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const biz = searchParams.get("biz");
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");

  if (!path || !biz) {
    return new NextResponse("Unauthorized: Missing required media path or business parameters.", {
      status: 401,
    });
  }

  // Strict tenant boundary check on storage path
  if (!verifyTenantStoragePath(biz, path)) {
    return new NextResponse("Cross-tenant media access violation.", { status: 403 });
  }

  let isAuthorized = false;

  // Mode 1: HMAC Tokenized Access (Public signed download link)
  if (exp && sig) {
    isAuthorized = verifySignedMediaToken(biz, path, exp, sig);
    if (!isAuthorized) {
      return new NextResponse("Unauthorized: Invalid or expired media access token.", {
        status: 403,
      });
    }
  } else {
    // Mode 2: Authenticated Session Access (Workspace UI Preview)
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Check business membership
          const { data: membership } = await supabase
            .from("business_members")
            .select("id, role, is_active")
            .eq("business_id", biz)
            .eq("user_id", user.id)
            .eq("is_active", true)
            .maybeSingle();

          if (membership) {
            isAuthorized = true;
          }
        }
      } catch {
        // Fall through
      }
    } else {
      // In local dev/mock test environments without live Supabase session
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return new NextResponse("Unauthorized: Authentication or valid signature required.", {
        status: 401,
      });
    }
  }

  try {
    const file = await getStoredMediaFile(biz, path);

    // Extract filename from storage path for Content-Disposition
    const filenamePart = path.split("/").pop() || "download";
    // Strip uuid prefix if present: uuid-filename
    const filename = filenamePart.replace(/^[0-9a-fA-F-]{36}-/, "");

    const mimeType = file.mimeType || "application/octet-stream";
    const isBranding = path.startsWith(`businesses/${biz}/branding/`);
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": isBranding
        ? "private, max-age=300"
        : "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    };

    if (mimeType === "image/svg+xml") {
      headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Failed to retrieve media file.", {
      status: 404,
    });
  }
}
