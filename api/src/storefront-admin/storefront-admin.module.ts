import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorefrontAdminController } from './storefront-admin.controller';
import { StorefrontAdminService } from './storefront-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [StorefrontAdminController],
  providers: [StorefrontAdminService]
})
export class StorefrontAdminModule {}
