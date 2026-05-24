import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicSeoController } from './public-seo.controller';
import { PublicSeoService } from './public-seo.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicSeoController],
  providers: [PublicSeoService]
})
export class PublicSeoModule {}
