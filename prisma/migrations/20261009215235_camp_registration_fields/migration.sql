-- AlterTable
ALTER TABLE "Event" ADD COLUMN "registrationFields" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "emergencyName" TEXT;
ALTER TABLE "Order" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "emergencyRelation" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupAuth" TEXT;
ALTER TABLE "Order" ADD COLUMN "waiverAcceptedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "waiverSignedName" TEXT;
ALTER TABLE "Order" ADD COLUMN "waiverTextSnapshot" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "medicalNotes" TEXT;
