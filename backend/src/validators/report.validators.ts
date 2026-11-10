import { z } from 'zod';
import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGETS } from '../db/schema.js';
import { paginationQuery } from '../utils/pagination.js';

export const createReportSchema = z.strictObject({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.uuid({ message: 'Invalid target' }),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const listReportsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(REPORT_STATUSES).optional(),
  targetType: z.enum(REPORT_TARGETS).optional(),
});

export const resolveReportSchema = z.strictObject({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(1000).optional(),
  removeContent: z.boolean().optional().default(false),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
