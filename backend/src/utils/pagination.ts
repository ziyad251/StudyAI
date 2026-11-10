import { z } from 'zod';

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
};

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function toOffset({ page, pageSize }: PageParams): number {
  return (page - 1) * pageSize;
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, pageSize }: PageParams,
): Paginated<T> {
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
