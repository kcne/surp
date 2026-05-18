import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class StorefrontSectionsInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hero?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rides?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  about?: boolean;
}

export class UpsertStorefrontDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  heroSubtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  heroImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  heroImageAlt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  aboutMarkdown?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  footerText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  logoAlt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @Matches(/^(https?:\/\/|\/).+/, {
    message: 'rideIconUrl must be an absolute URL or root-relative path'
  })
  @MaxLength(500)
  rideIconUrl?: string;

  @ApiPropertyOptional({ example: '#1D4ED8' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @ApiPropertyOptional({ type: StorefrontSectionsInputDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StorefrontSectionsInputDto)
  sectionsEnabled?: StorefrontSectionsInputDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  ogImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  facebookUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  instagramUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  twitterUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string;
}
