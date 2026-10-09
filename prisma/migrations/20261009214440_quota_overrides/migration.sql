-- CreateTable
CREATE TABLE "OrganizationQuotaOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "OrganizationQuotaOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OrganizationQuotaOverride_organizationId_metric_idx" ON "OrganizationQuotaOverride"("organizationId", "metric");

-- CreateIndex
CREATE INDEX "OrganizationQuotaOverride_expiresAt_idx" ON "OrganizationQuotaOverride"("expiresAt");
