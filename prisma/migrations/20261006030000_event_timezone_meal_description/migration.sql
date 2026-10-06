-- Event wall-clock zone, and an optional short hint on meal labels.
ALTER TABLE "Event" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';
ALTER TABLE "MealOption" ADD COLUMN "description" TEXT;

-- Existing events follow the organization zone so home, the event page,
-- emails, and tickets show the same clock time.
UPDATE "Event"
SET "timezone" = (
  SELECT "Organization"."timezone"
  FROM "Organization"
  WHERE "Organization"."id" = "Event"."organizationId"
)
WHERE "organizationId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Organization"
    WHERE "Organization"."id" = "Event"."organizationId"
      AND "Organization"."timezone" IS NOT NULL
      AND "Organization"."timezone" != ''
  );
