-- AlterTable
ALTER TABLE "public"."Propiedad" ADD COLUMN     "reference_address" TEXT,
ADD COLUMN     "reference_lat" DOUBLE PRECISION,
ADD COLUMN     "reference_lng" DOUBLE PRECISION,
ADD COLUMN     "show_exact_location" BOOLEAN NOT NULL DEFAULT true;
