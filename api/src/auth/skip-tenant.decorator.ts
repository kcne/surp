import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_GUARD_KEY } from './auth.constants';

export const SkipTenantGuard = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_TENANT_GUARD_KEY, true);
