// scripts/seed-admins.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

const ADMIN_EMAILS = ['admin@tuportal.cl', 'ingrid.espinoza@ayelegaleinmobiliario.cl'];
async function main() {
  const tempPassword = process.env.ADMIN_TMP_PASS ?? 'Cambiar.123';
  const hash = await bcrypt.hash(tempPassword, 12);

  for (const email of ADMIN_EMAILS) {
    const exists = await prisma.usuario.findUnique({ where: { email } });
    if (exists) {
      await prisma.usuario.update({
        where: { email },
        data: { rol: 'admin', mustChangePassword: true, isActive: true },
      });
    } else {
      await prisma.usuario.create({
        data: {
          nombre: 'Ingrid Espinoza',
          email,
          password: hash,
          rol: 'admin',
          mustChangePassword: true,
          isActive: true,
        },
      });
    }
    console.log(`[OK] Admin preparado: ${email}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
