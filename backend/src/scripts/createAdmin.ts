import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('TuPasswordSuperSegura2024', 10);
  await prisma.usuario.create({
    data: {
      nombre: 'Admin Principal',
      email: 'admin@tuportal.cl',
      password: hashedPassword,
      rol: 'admin'
    }
  });
  console.log('Usuario admin creado correctamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
