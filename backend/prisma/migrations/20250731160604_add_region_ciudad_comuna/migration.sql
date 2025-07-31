/*
  Warnings:

  - You are about to drop the column `location` on the `Propiedad` table. All the data in the column will be lost.
  - Added the required column `comunaId` to the `Propiedad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Propiedad" DROP COLUMN "location",
ADD COLUMN     "comunaId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."Region" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ciudad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "Ciudad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comuna" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudadId" INTEGER NOT NULL,

    CONSTRAINT "Comuna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_nombre_key" ON "public"."Region"("nombre");

-- AddForeignKey
ALTER TABLE "public"."Ciudad" ADD CONSTRAINT "Ciudad_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comuna" ADD CONSTRAINT "Comuna_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "public"."Ciudad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Propiedad" ADD CONSTRAINT "Propiedad_comunaId_fkey" FOREIGN KEY ("comunaId") REFERENCES "public"."Comuna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
