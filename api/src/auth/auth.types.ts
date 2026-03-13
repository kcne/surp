import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  role: UserRole;
  username: string;
  iat?: number;
  exp?: number;
};

export type RequestWithAuth = Request & {
  auth?: AccessTokenPayload;
};
