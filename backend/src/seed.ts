import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, '../prisma/chile_provincias.json'); // nombre del JSON que descargaste
  const raw = fs.readFileSync(dataPath, 'utf8');
  const regionesObj = JSON.parse(raw);

  for (const regionNombre in regionesObj) {
    const regionData = regionesObj[regionNombre];
    // 1. Crear o buscar región
    const region = await prisma.region.upsert({
      where: { nombre: regionNombre },
      update: {},
      create: { nombre: regionNombre }
    });

    const provincias = regionData.provincias;
    for (const provinciaNombre in provincias) {
      const provinciaData = provincias[provinciaNombre];
      // 2. Crear o buscar ciudad (usamos provincia como ciudad)
      const ciudad = await prisma.ciudad.upsert({
        where: {
          nombre_regionId: {
            nombre: provinciaNombre,
            regionId: region.id
          }
        },
        update: {},
        create: {
          nombre: provinciaNombre,
          regionId: region.id
        }
      });

      // 3. Comunas de la provincia
      for (const comunaNombre of provinciaData.comunas) {
        await prisma.comuna.upsert({
          where: {
            nombre_ciudadId: {
              nombre: comunaNombre,
              ciudadId: ciudad.id
            }
          },
          update: {},
          create: {
            nombre: comunaNombre,
            ciudadId: ciudad.id
          }
        });
      }
    }
  }
  console.log('✅ Regiones, provincias (como ciudad) y comunas pobladas correctamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
