import { ApiPropertyOptional } from '@nestjs/swagger';
import { MarketingLeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlatformLeadDto {
  @ApiPropertyOptional({ enum: MarketingLeadStatus })
  @IsOptional()
  @IsEnum(MarketingLeadStatus)
  status?: MarketingLeadStatus;

  @ApiPropertyOptional({ example: 'Called twice, follow up next week.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ example: 'superadmin-1', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeUserId?: string | null;
}
