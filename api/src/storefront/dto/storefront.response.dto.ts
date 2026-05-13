import { ApiProperty } from '@nestjs/swagger';
import { StorefrontStatus } from '@prisma/client';

export class StorefrontSectionsDto {
  @ApiProperty()
  hero!: boolean;

  @ApiProperty()
  rides!: boolean;

  @ApiProperty()
  about!: boolean;
}

export class StorefrontSocialLinksDto {
  @ApiProperty({ nullable: true })
  facebookUrl!: string | null;

  @ApiProperty({ nullable: true })
  instagramUrl!: string | null;

  @ApiProperty({ nullable: true })
  twitterUrl!: string | null;

  @ApiProperty({ nullable: true })
  linkedinUrl!: string | null;

  @ApiProperty({ nullable: true })
  websiteUrl!: string | null;
}

export class StorefrontContentDto {
  @ApiProperty({ enum: StorefrontStatus })
  status!: StorefrontStatus;

  @ApiProperty({ nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ nullable: true })
  heroTitle!: string | null;

  @ApiProperty({ nullable: true })
  heroSubtitle!: string | null;

  @ApiProperty({ nullable: true })
  heroImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  heroImageAlt!: string | null;

  @ApiProperty({ nullable: true })
  aboutMarkdown!: string | null;

  @ApiProperty({ nullable: true })
  footerText!: string | null;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true })
  logoAlt!: string | null;

  @ApiProperty({ nullable: true })
  primaryColor!: string | null;

  @ApiProperty({ type: StorefrontSectionsDto })
  sectionsEnabled!: StorefrontSectionsDto;

  @ApiProperty({ nullable: true })
  seoTitle!: string | null;

  @ApiProperty({ nullable: true })
  seoDescription!: string | null;

  @ApiProperty({ nullable: true })
  ogImageUrl!: string | null;

  @ApiProperty({ type: StorefrontSocialLinksDto })
  socialLinks!: StorefrontSocialLinksDto;

  @ApiProperty()
  updatedAt!: Date;
}

export class PublicStorefrontRideSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lineName!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty({ type: [String] })
  departureTimes!: string[];

  @ApiProperty()
  days!: string;
}

export class PublicAgencyStorefrontResponseDto extends StorefrontContentDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  timezone!: string | null;

  @ApiProperty({ type: [PublicStorefrontRideSummaryDto] })
  rides!: PublicStorefrontRideSummaryDto[];
}

export class StorefrontAdminResponseDto extends StorefrontContentDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  tenantSlug!: string;

  @ApiProperty()
  tenantName!: string;
}
