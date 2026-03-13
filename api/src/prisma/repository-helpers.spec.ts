import {
  MAX_PAGE_SIZE,
  buildContainsSearchWhere,
  buildListQueryArgs,
  resolvePagination
} from './repository-helpers';

describe('repository helpers', () => {
  it('resolves default pagination when no values are provided', () => {
    const result = resolvePagination();

    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      skip: 0,
      take: 25
    });
  });

  it('caps page size to configured maximum', () => {
    const result = resolvePagination(2, MAX_PAGE_SIZE + 50);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.skip).toBe(MAX_PAGE_SIZE);
    expect(result.take).toBe(MAX_PAGE_SIZE);
  });

  it('normalizes invalid and decimal pagination input', () => {
    const result = resolvePagination(-2, 10.9);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(10);
  });

  it('builds contains search filter across fields', () => {
    const where = buildContainsSearchWhere(' central ', ['name', 'code']);

    expect(where).toEqual({
      OR: [
        {
          name: {
            contains: 'central',
            mode: 'insensitive'
          }
        },
        {
          code: {
            contains: 'central',
            mode: 'insensitive'
          }
        }
      ]
    });
  });

  it('returns undefined where clause when search is empty', () => {
    const where = buildContainsSearchWhere('   ', ['name']);

    expect(where).toBeUndefined();
  });

  it('deduplicates repeated fields in search where clause', () => {
    const where = buildContainsSearchWhere('central', ['name', 'name', 'code']);

    expect(where).toEqual({
      OR: [
        {
          name: {
            contains: 'central',
            mode: 'insensitive'
          }
        },
        {
          code: {
            contains: 'central',
            mode: 'insensitive'
          }
        }
      ]
    });
  });

  it('builds list query args with pagination and filters', () => {
    const args = buildListQueryArgs({
      page: 3,
      pageSize: 10,
      search: ' station ',
      searchFields: ['name']
    });

    expect(args).toEqual({
      skip: 20,
      take: 10,
      where: {
        OR: [
          {
            name: {
              contains: 'station',
              mode: 'insensitive'
            }
          }
        ]
      }
    });
  });
});
