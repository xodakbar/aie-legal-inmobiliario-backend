/*
  Warnings:

  - Added the required column `imagen` to the `Propiedad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Propiedad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Propiedad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Propiedad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Propiedad" ADD COLUMN     "address" TEXT,
ADD COLUMN     "area" INTEGER,
ADD COLUMN     "bathrooms" INTEGER,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "bodega" INTEGER,
ADD COLUMN     "expenses" INTEGER,
ADD COLUMN     "imagen" TEXT NOT NULL,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "parking" INTEGER,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "yearBuilt" INTEGER;
