// Shared sponsor-tier helpers. Tiers are stored as plain strings ("GOLD",
// "SILVER", "BRONZE", "MENTION") and ranked in code so display order never
// depends on database enum ordering.

export const SPONSOR_TIERS = ["GOLD", "SILVER", "BRONZE", "MENTION"] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];

export const TIER_RANK: Record<string, number> = {
  GOLD: 0,
  SILVER: 1,
  BRONZE: 2,
  MENTION: 3,
};

export const TIER_LABELS: Record<string, string> = {
  GOLD: "Gold sponsors",
  SILVER: "Silver sponsors",
  BRONZE: "Bronze sponsors",
  MENTION: "Special mentions",
};

export const TIER_SINGULAR: Record<string, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
  MENTION: "Special mention",
};

export function isValidTier(t: unknown): t is SponsorTier {
  return typeof t === "string" && (SPONSOR_TIERS as readonly string[]).includes(t);
}

export function normalizeTier(t: unknown): SponsorTier {
  return isValidTier(t) ? t : "SILVER";
}

export function tierRank(tier: unknown): number {
  return typeof tier === "string" && tier in TIER_RANK ? TIER_RANK[tier] : 99;
}

/** Gold first, then Silver, Bronze, special mentions; stable within a tier. */
export function sortSponsorAds<T extends { tier?: string | null; sortOrder?: number | null; createdAt?: Date | string }>(
  ads: T[]
): T[] {
  return [...ads].sort((a, b) => {
    const r = tierRank(a.tier) - tierRank(b.tier);
    if (r !== 0) return r;
    const s = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (s !== 0) return s;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
}
