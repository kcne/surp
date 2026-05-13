import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StorefrontStatus } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePrimaryColor } from '../storefront/color-validation';
import {
  STOREFRONT_SELECT,
  buildDraftStorefrontDto,
  mapStorefrontToAdminDto,
  normalizeSectionsInput
} from '../storefront/storefront.mapper';
import { StorefrontAdminResponseDto } from '../storefront/dto/storefront.response.dto';
import { UpsertStorefrontDto } from './dto/upsert-storefront.dto';

type StorefrontTextField =
  | 'heroTitle'
  | 'heroSubtitle'
  | 'heroImageUrl'
  | 'heroImageAlt'
  | 'aboutMarkdown'
  | 'footerText'
  | 'logoUrl'
  | 'logoAlt'
  | 'primaryColor'
  | 'seoTitle'
  | 'seoDescription'
  | 'ogImageUrl'
  | 'facebookUrl'
  | 'instagramUrl'
  | 'twitterUrl'
  | 'linkedinUrl'
  | 'websiteUrl';

type StorefrontWriteData = Partial<Record<StorefrontTextField, string | null>> & {
  sectionsEnabled?: Prisma.InputJsonValue;
};

@Injectable()
export class StorefrontAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(auth: AccessTokenPayload): Promise<StorefrontAdminResponseDto> {
    const storefront = await this.prisma.agencyStorefront.findUnique({
      where: {
        tenantId: auth.tenantId
      },
      select: STOREFRONT_SELECT
    });

    if (storefront) {
      return mapStorefrontToAdminDto(storefront);
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: auth.tenantId
      },
      select: {
        id: true,
        slug: true,
        name: true,
        timezone: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return buildDraftStorefrontDto(tenant);
  }

  async upsert(auth: AccessTokenPayload, dto: UpsertStorefrontDto): Promise<StorefrontAdminResponseDto> {
    const data = this.buildStorefrontData(dto);

    const storefront = await this.prisma.agencyStorefront.upsert({
      where: {
        tenantId: auth.tenantId
      },
      create: {
        tenantId: auth.tenantId,
        ...data
      },
      update: data,
      select: STOREFRONT_SELECT
    });

    return mapStorefrontToAdminDto(storefront);
  }

  async publish(auth: AccessTokenPayload): Promise<StorefrontAdminResponseDto> {
    const storefront = await this.updateStorefrontStatusOrThrow(auth.tenantId, {
      status: StorefrontStatus.PUBLISHED,
      publishedAt: new Date()
    });

    return mapStorefrontToAdminDto(storefront);
  }

  async unpublish(auth: AccessTokenPayload): Promise<StorefrontAdminResponseDto> {
    const storefront = await this.updateStorefrontStatusOrThrow(auth.tenantId, {
      status: StorefrontStatus.DRAFT,
      publishedAt: null
    });

    return mapStorefrontToAdminDto(storefront);
  }

  private async updateStorefrontStatusOrThrow(
    tenantId: string,
    data: Pick<Prisma.AgencyStorefrontUncheckedUpdateInput, 'status' | 'publishedAt'>
  ) {
    try {
      return await this.prisma.agencyStorefront.update({
        where: {
          tenantId
        },
        data,
        select: STOREFRONT_SELECT
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Storefront configuration not found');
      }

      throw error;
    }
  }

  private buildStorefrontData(dto: UpsertStorefrontDto): StorefrontWriteData {
    const data: StorefrontWriteData = {};

    this.assignOptionalText(data, 'heroTitle', dto.heroTitle);
    this.assignOptionalText(data, 'heroSubtitle', dto.heroSubtitle);
    this.assignOptionalText(data, 'heroImageUrl', dto.heroImageUrl);
    this.assignOptionalText(data, 'heroImageAlt', dto.heroImageAlt);
    this.assignOptionalText(data, 'aboutMarkdown', dto.aboutMarkdown);
    this.assignOptionalText(data, 'footerText', dto.footerText);
    this.assignOptionalText(data, 'logoUrl', dto.logoUrl);
    this.assignOptionalText(data, 'logoAlt', dto.logoAlt);
    this.assignOptionalText(data, 'seoTitle', dto.seoTitle);
    this.assignOptionalText(data, 'seoDescription', dto.seoDescription);
    this.assignOptionalText(data, 'ogImageUrl', dto.ogImageUrl);
    this.assignOptionalText(data, 'facebookUrl', dto.facebookUrl);
    this.assignOptionalText(data, 'instagramUrl', dto.instagramUrl);
    this.assignOptionalText(data, 'twitterUrl', dto.twitterUrl);
    this.assignOptionalText(data, 'linkedinUrl', dto.linkedinUrl);
    this.assignOptionalText(data, 'websiteUrl', dto.websiteUrl);

    const primaryColor = normalizePrimaryColor(dto.primaryColor);
    if (primaryColor !== undefined) {
      data.primaryColor = primaryColor;
    }

    if (dto.sectionsEnabled !== undefined) {
      data.sectionsEnabled = normalizeSectionsInput(dto.sectionsEnabled) as Prisma.InputJsonValue;
    }

    return data;
  }

  private assignOptionalText(
    data: StorefrontWriteData,
    field: StorefrontTextField,
    value: string | undefined,
  ): void {
    if (typeof value !== 'string') {
      return;
    }

    data[field] = value.trim() || null;
  }
}
