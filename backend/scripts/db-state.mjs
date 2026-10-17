// Prints the migration state of DATABASE_URL, used by migrate-deploy.sh:
//   empty    — no application tables yet (fresh database)
//   migrated — `_prisma_migrations` exists (managed by prisma migrate)
//   pushed   — application tables exist but no `_prisma_migrations`
//              (built by `prisma db push`, as production was until 2026-10)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRaw`
    SELECT to_regclass('public._prisma_migrations')::text AS migrations,
           to_regclass('public."User"')::text AS users`;
  const { migrations, users } = rows[0];
  if (migrations) console.log('migrated');
  else if (users) console.log('pushed');
  else console.log('empty');
} finally {
  await prisma.$disconnect();
}
