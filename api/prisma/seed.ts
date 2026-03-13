import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baselineMessage = 'baseline-seed';

  const existingBaseline = await prisma.healthCheckLog.findFirst({
    where: {
      message: baselineMessage
    }
  });

  if (!existingBaseline) {
    await prisma.healthCheckLog.create({
      data: {
        message: baselineMessage
      }
    });
    console.log('Inserted baseline seed record.');
    return;
  }

  console.log('Baseline seed record already exists.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
