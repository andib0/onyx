import { PrismaClient } from '@prisma/client';
import { foods } from './foods.js';
import { supplements } from './supplements.js';
import { programs } from './programs.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed foods
  console.log('Seeding foods...');
  const existingFoods = await prisma.food.count();
  if (existingFoods === 0) {
    await prisma.food.createMany({
      data: foods,
    });
    console.log(`Created ${foods.length} foods`);
  } else {
    console.log(`Foods already seeded (${existingFoods} existing)`);
  }

  // Seed supplement database
  console.log('Seeding supplement database...');
  const existingSupplements = await prisma.supplementDatabase.count();
  if (existingSupplements === 0) {
    await prisma.supplementDatabase.createMany({
      data: supplements,
    });
    console.log(`Created ${supplements.length} supplements`);
  } else {
    console.log(`Supplements already seeded (${existingSupplements} existing)`);
  }

  // Seed gym programs
  console.log('Seeding gym programs...');
  const existingPrograms = await prisma.gymProgram.count();
  if (existingPrograms === 0) {
    for (const program of programs) {
      const { days, ...programData } = program;

      const createdProgram = await prisma.gymProgram.create({
        data: {
          ...programData,
          isSystem: true,
        },
      });

      for (const day of days) {
        const { exercises, ...dayData } = day;

        const createdDay = await prisma.programDay.create({
          data: {
            ...dayData,
            programId: createdProgram.id,
          },
        });

        await prisma.programExercise.createMany({
          data: exercises.map(ex => ({
            ...ex,
            programDayId: createdDay.id,
          })),
        });
      }

      console.log(`Created program: ${program.name}`);
    }
    console.log(`Created ${programs.length} gym programs`);
  } else {
    console.log(`Programs already seeded (${existingPrograms} existing)`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
