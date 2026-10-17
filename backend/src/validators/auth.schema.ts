import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  username: z.string().min(1, 'Username is required').max(50).optional(),
  age: z.number().int().min(13).max(120).optional(),
  weight: z.number().min(20).max(300).optional(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

/** Body is optional: browsers send the token in the httpOnly cookie instead. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096).optional(),
});

export const logoutSchema = refreshSchema;

export const profileSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(50).optional(),
  age: z.number().int().min(13).max(120).optional(),
  weight: z.number().min(20).max(300).optional(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
