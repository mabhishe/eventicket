/**
 * Public self-serve signup. Off unless ALLOW_PUBLIC_SIGNUP=true.
 * Organizers still add door and staff logins from Team.
 */
export function publicSignupEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}
