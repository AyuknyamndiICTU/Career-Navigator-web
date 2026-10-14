import { BadRequestException } from '@nestjs/common';

export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function parsePagination(
  pageRaw?: string,
  limitRaw?: string,
): { page: number; limit: number } {
  const page = toPositiveInt(pageRaw, 1);
  const limit = toPositiveInt(limitRaw, DEFAULT_PAGE_SIZE);

  if (limit > MAX_PAGE_SIZE) {
    throw new BadRequestException(`limit must not exceed ${MAX_PAGE_SIZE}`);
  }

  return { page, limit };
}
