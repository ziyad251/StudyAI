import { z } from 'zod';
import {
  academicYearSchema,
  emailSchema,
  passwordSchema,
  rollNumberSchema,
  text,
} from './common.validators.js';

export const registerSchema = z
  .strictObject({
    fullName: text(2, 120, 'Full name'),
    email: emailSchema,
    password: passwordSchema,
    department: text(2, 120, 'Department'),
    academicYear: academicYearSchema,
    rollNumber: rollNumberSchema,
  })
  .refine(
    (data) => !data.password.toLowerCase().includes(data.email.split('@')[0]!.toLowerCase()),
    { path: ['password'], message: 'Password must not contain your email name' },
  );

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required').max(200),
});

export const updateProfileSchema = z
  .strictObject({
    fullName: text(2, 120, 'Full name').optional(),
    department: text(2, 120, 'Department').optional(),
    academicYear: academicYearSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Current password is required').max(200),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
