/*
  Warnings:

  - A unique constraint covering the columns `[nombre,regionId]` on the table `Ciudad` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nombre,ciudadId]` on the table `Comuna` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Ciudad_nombre_regionId_key" ON "public"."Ciudad"("nombre", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Comuna_nombre_ciudadId_key" ON "public"."Comuna"("nombre", "ciudadId");
