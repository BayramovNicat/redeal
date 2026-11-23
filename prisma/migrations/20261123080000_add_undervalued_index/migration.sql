-- CreateIndex
CREATE INDEX "Property_listing_type_category_location_name_price_per_sqm_idx" ON "Property"("listing_type", "category", "location_name", "price_per_sqm");
