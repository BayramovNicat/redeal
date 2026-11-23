-- AlterTable
ALTER TABLE "Property" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Property_expires_at_idx" ON "Property"("expires_at");
