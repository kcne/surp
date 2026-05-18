import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { StorefrontAdminController } from './storefront-admin.controller';
import { StorefrontAdminService } from './storefront-admin.service';

@Module({
  imports: [PrismaModule, ConfigModule, StorageModule],
  controllers: [StorefrontAdminController],
  providers: [StorefrontAdminService]
})
export class StorefrontAdminModule {}
