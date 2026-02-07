import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleServiceError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return new AppError('Record not found', 404, 'NOT_FOUND');
    }
    if (error.code === 'P2002') {
      return new AppError('Record already exists', 409, 'DUPLICATE');
    }
    if (error.code === 'P2003') {
      return new AppError('Referenced record not found', 400, 'FOREIGN_KEY');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError('Invalid data provided', 400, 'VALIDATION');
  }

  console.error('Unhandled error:', error);
  return new AppError('Internal server error', 500, 'INTERNAL');
}
