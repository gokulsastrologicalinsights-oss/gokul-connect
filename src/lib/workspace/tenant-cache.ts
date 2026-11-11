/**
 * Clears all client-side cached data for the workspace to prevent cross-tenant data leakage.
 */
export function clearWorkspaceTenantCache(): void {
  const targetWindow = typeof window !== "undefined" ? window : (globalThis as any).window;
  if (targetWindow) {
    try {
      targetWindow.sessionStorage?.removeItem("active_workspace_cache");
      targetWindow.sessionStorage?.removeItem("active_conversation_id");
      targetWindow.sessionStorage?.removeItem("active_connections_cache");
      targetWindow.sessionStorage?.removeItem("active_business_settings");
      targetWindow.localStorage?.removeItem("last_opened_inbox_chat");
      targetWindow.localStorage?.removeItem("cached_connections");
    } catch {
      // Storage access error or private mode
    }
  }
}
