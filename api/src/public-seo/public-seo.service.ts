import { Injectable } from '@nestjs/common';
import { StorefrontStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicSeoSitemapDataResponseDto } from './dto/sitemap-data.response.dto';

@Injectable()
export class PublicSeoService {
  constructor(private readonly prisma: PrismaService) {}

  async getSitemapData(): Promise<PublicSeoSitemapDataResponseDto> {
    const storefronts = await this.prisma.agencyStorefront.findMany({
      where: {
        status: StorefrontStatus.PUBLISHED,
        tenant: {
          isActive: true
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        updatedAt: true,
        tenant: {
          select: {
            slug: true,
            name: true
          }
        }
      }
    });

    return {
      agencies: storefronts.map((storefront) => ({
        slug: storefront.tenant.slug,
        name: storefront.tenant.name,
        updatedAt: storefront.updatedAt
      }))
    };
  }
}
