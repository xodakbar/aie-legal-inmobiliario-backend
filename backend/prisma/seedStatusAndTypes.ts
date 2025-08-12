import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  await prisma.status.createMany({
    data: [
      { name: 'venta' },
      { name: 'arriendo' },
    ],
    skipDuplicates: true,
  });

  await prisma.propertyType.createMany({
    data: [
      { name: 'departamento' },
      { name: 'casa' },
      { name: 'terreno' },
      { name: 'oficina' },
    ],
    skipDuplicates: true,
  });

  console.log('Status y PropertyType seed completado');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
