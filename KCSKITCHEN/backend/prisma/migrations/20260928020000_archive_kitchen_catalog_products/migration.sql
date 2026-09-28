ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Product_archivedAt_category_isAvailable_idx"
ON "Product"("archivedAt", "category", "isAvailable");
