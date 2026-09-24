ALTER TABLE "Order" ADD COLUMN "refCode" TEXT;
CREATE UNIQUE INDEX "Order_refCode_key" ON "Order"("refCode");
