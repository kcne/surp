import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdatePlatformTenantDto {
  @ApiPropertyOptional({ example: 'acme-transit' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ example: 'Acme Transit' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Europe/Belgrade' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}
