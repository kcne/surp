/**
 * Makes every non-generated create column mandatory. Prisma deliberately marks
 * columns with database defaults optional; that is convenient for ordinary
 * inserts but unsafe for delete-and-rewrite code, where omission loses the old
 * value. A new schema column therefore becomes a compile error at each total
 * writer until its value is handled explicitly.
 */
export type TotalRow<T, Generated extends keyof T> = Required<Omit<T, Generated>>;
