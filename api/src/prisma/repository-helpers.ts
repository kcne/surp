export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface ContainsFilter {
  contains: string;
  mode: 'insensitive';
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface SearchWhereClause<TField extends string = string> {
  OR: Array<Record<TField, ContainsFilter>>;
}

export interface ListQueryInput<TField extends string = string> {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: readonly TField[];
}

export interface ListQueryArgs<TField extends string = string> {
  skip: number;
  take: number;
  where?: SearchWhereClause<TField>;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

export function resolvePagination(page?: number, pageSize?: number): PaginationParams {
  const normalizedPage = normalizePositiveInteger(page, DEFAULT_PAGE);
  const normalizedPageSize = Math.min(
    normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize
  };
}

export function buildContainsSearchWhere<TField extends string>(
  search?: string,
  fields: readonly TField[] = []
): SearchWhereClause<TField> | undefined {
  const term = search?.trim();
  const uniqueFields = [...new Set(fields.filter(Boolean))] as TField[];

  if (!term || uniqueFields.length === 0) {
    return undefined;
  }

  return {
    OR: uniqueFields.map((field) => ({
      [field]: {
        contains: term,
        mode: 'insensitive'
      }
    })) as Array<Record<TField, ContainsFilter>>
  };
}

export function buildListQueryArgs<TField extends string>(
  input: ListQueryInput<TField>
): ListQueryArgs<TField> {
  const pagination = resolvePagination(input.page, input.pageSize);

  return {
    skip: pagination.skip,
    take: pagination.take,
    where: buildContainsSearchWhere<TField>(input.search, input.searchFields)
  };
}
