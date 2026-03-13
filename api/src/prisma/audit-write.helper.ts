type AuditFieldCarrier = {
  createdById?: string;
  updatedById?: string;
};

function assertActorId(actorUserId: string): void {
  if (!actorUserId?.trim()) {
    throw new Error('actor user id is required for audit writes');
  }
}

export function withCreateAudit<T extends Record<string, unknown>>(
  data: T,
  actorUserId: string
): Omit<T, keyof AuditFieldCarrier> & Required<AuditFieldCarrier> {
  assertActorId(actorUserId);

  const sanitized = { ...data } as T & AuditFieldCarrier;
  delete sanitized.createdById;
  delete sanitized.updatedById;

  return {
    ...(sanitized as Omit<T, keyof AuditFieldCarrier>),
    createdById: actorUserId,
    updatedById: actorUserId
  };
}

export function withUpdateAudit<T extends Record<string, unknown>>(
  data: T,
  actorUserId: string,
  now: Date = new Date()
): Omit<T, keyof AuditFieldCarrier> & { updatedById: string; updatedAt: Date } {
  assertActorId(actorUserId);

  const sanitized = { ...data } as T & AuditFieldCarrier;
  delete sanitized.createdById;
  delete sanitized.updatedById;

  return {
    ...(sanitized as Omit<T, keyof AuditFieldCarrier>),
    updatedById: actorUserId,
    updatedAt: now
  };
}
