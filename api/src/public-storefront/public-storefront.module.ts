import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicStorefrontController } from './public-storefront.controller';
import { PublicStorefrontService } from './public-storefront.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicStorefrontController],
  providers: [PublicStorefrontService]
})
export class PublicStorefrontModule {}
