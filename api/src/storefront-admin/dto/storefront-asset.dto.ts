import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateStorefrontAssetPresignDto {
  @ApiProperty({ example: 'ride-icon.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 24576 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CompleteStorefrontAssetUploadDto {
  @ApiProperty({ example: 'tenants/tenant-id/storefront/ride-icon/uuid-ride-icon.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  storageKey!: string;

  @ApiProperty({ example: 'ride-icon.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 24576 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class StorefrontAssetPresignResponseDto {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds!: number;
}
