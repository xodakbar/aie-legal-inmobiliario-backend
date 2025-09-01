import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  await prisma.status.createMany({
    data: [
      { name: 'Venta' },
      { name: 'Arriendo' },
    ],
    skipDuplicates: true,
  });

  await prisma.propertyType.createMany({
    data: [
      { name: 'Departamento' },
      { name: 'Casa' },
      { name: 'Terreno' },
      { name: 'Oficina' },
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
