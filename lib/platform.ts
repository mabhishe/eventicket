/**
 * Platform admins (us — the EventPass operators) vs organization admins.
 * Set PLATFORM_ADMIN_EMAILS to a comma-separated list of login emails.
 * Platform admins get the /admin/platform panel: view every org,
 * set plans, and override plan limits per org.
 */
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}
