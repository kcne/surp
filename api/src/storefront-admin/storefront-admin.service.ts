import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StorefrontStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { normalizePrimaryColor } from '../storefront/color-validation';
import {
  STOREFRONT_SELECT,
  buildDraftStorefrontDto,
  mapStorefrontToAdminDto,
  normalizeSectionsInput
} from '../storefront/storefront.mapper';
import { StorefrontAdminResponseDto } from '../storefront/dto/storefront.response.dto';
import {
  CompleteStorefrontAssetUploadDto,
  StorefrontAssetPresignResponseDto
} from './dto/storefront-asset.dto';
import { UpsertStorefrontDto } from './dto/upsert-storefront.dto';

const ALLOWED_STOREFRONT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type StorefrontTextField =
  | 'heroTitle'
  | 'heroSubtitle'
  | 'heroImageUrl'
  | 'heroImageAlt'
  | 'aboutMarkdown'
  | 'footerText'
  | 'logoUrl'
  | 'logoAlt'
  | 'rideIconUrl'
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
  rideIconStorageKey?: string | null;
};

@Injectable()
export class StorefrontAdminService {
  private readonly maxImageBytes: number;
  private readonly uploadUrlTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly objectStorageService: ObjectStorageService
  ) {
    this.maxImageBytes = this.configService.get<number>('STOREFRONT_MAX_IMAGE_BYTES', 1024 * 1024);
    this.uploadUrlTtlSeconds = this.configService.get<number>('STOREFRONT_UPLOAD_URL_TTL_SECONDS', 600);
  }

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

  async presignRideIconUpload(
    auth: AccessTokenPayload,
    fileName: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<StorefrontAssetPresignResponseDto> {
    this.assertImageUploadAllowed(fileName, mimeType, sizeBytes);

    const sanitizedFileName = this.sanitizeFileName(fileName);
    const storageKey = `tenants/${auth.tenantId}/storefront/ride-icon/${randomUUID()}-${sanitizedFileName}`;
    const uploadUrl = await this.objectStorageService.createUploadUrl(
      storageKey,
      mimeType,
      this.uploadUrlTtlSeconds
    );

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds: this.uploadUrlTtlSeconds
    };
  }

  async completeRideIconUpload(
    auth: AccessTokenPayload,
    dto: CompleteStorefrontAssetUploadDto
  ): Promise<StorefrontAdminResponseDto> {
    this.assertImageUploadAllowed(dto.fileName, dto.mimeType, dto.sizeBytes);
    this.assertStorageKeyBelongsToRideIcon(auth.tenantId, dto.storageKey);

    const objectExists = await this.objectStorageService.objectExists(dto.storageKey);
    if (!objectExists) {
      throw new BadRequestException('Uploaded file not found in bucket for provided storageKey');
    }

    const metadata = await this.objectStorageService.headObject(dto.storageKey);
    if (metadata.contentLength !== null && metadata.contentLength > this.maxImageBytes) {
      throw new BadRequestException(`Image exceeds maximum allowed size of ${this.maxImageBytes} bytes`);
    }

    if (metadata.contentType && !ALLOWED_STOREFRONT_IMAGE_MIME_TYPES.has(metadata.contentType)) {
      throw new BadRequestException('Unsupported uploaded image type');
    }

    const storefront = await this.prisma.agencyStorefront.upsert({
      where: {
        tenantId: auth.tenantId
      },
      create: {
        tenantId: auth.tenantId,
        rideIconUrl: null,
        rideIconStorageKey: dto.storageKey
      },
      update: {
        rideIconUrl: null,
        rideIconStorageKey: dto.storageKey
      },
      select: STOREFRONT_SELECT
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
    this.assignOptionalText(data, 'rideIconUrl', dto.rideIconUrl);
    if (typeof dto.rideIconUrl === 'string') {
      data.rideIconStorageKey = null;
    }
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

  private assertImageUploadAllowed(fileName: string, mimeType: string, sizeBytes: number): void {
    if (!fileName.trim()) {
      throw new BadRequestException('fileName is required');
    }

    if (!ALLOWED_STOREFRONT_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported image type');
    }

    if (sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be greater than zero');
    }

    if (sizeBytes > this.maxImageBytes) {
      throw new BadRequestException(`Image exceeds maximum allowed size of ${this.maxImageBytes} bytes`);
    }
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = fileName.trim().toLowerCase();
    const sanitized = normalized.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
    return sanitized.slice(0, 120) || 'image';
  }

  private assertStorageKeyBelongsToRideIcon(tenantId: string, storageKey: string): void {
    if (storageKey.includes('..')) {
      throw new BadRequestException('storageKey contains invalid path traversal segments');
    }

    const expectedPrefix = `tenants/${tenantId}/storefront/ride-icon/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException('storageKey does not belong to the current tenant storefront context');
    }
  }
}
