import { ApiProperty } from '@nestjs/swagger';
import { MarketingLeadDeparturesPerDay, MarketingLeadStatus } from '@prisma/client';
import { PlatformTenantResponseDto } from '../../platform-tenants/dto/platform-tenant.response.dto';
import { UserResponseDto } from '../../users/dto/user.response.dto';

export class PlatformLeadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MarketingLeadStatus })
  status!: MarketingLeadStatus;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: MarketingLeadDeparturesPerDay })
  departuresPerDay!: MarketingLeadDeparturesPerDay;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true })
  assigneeUserId!: string | null;

  @ApiProperty({ nullable: true })
  convertedTenantId!: string | null;

  @ApiProperty({ nullable: true })
  convertedAt!: Date | null;

  @ApiProperty({ nullable: true })
  internalEmailSentAt!: Date | null;

  @ApiProperty({ nullable: true })
  confirmationEmailSentAt!: Date | null;

  @ApiProperty({ nullable: true })
  lastEmailError!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedPlatformLeadsResponseDto {
  @ApiProperty({ type: [PlatformLeadResponseDto] })
  items!: PlatformLeadResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  total!: number;
}

export class ConvertPlatformLeadResponseDto {
  @ApiProperty({ type: PlatformLeadResponseDto })
  lead!: PlatformLeadResponseDto;

  @ApiProperty({ type: PlatformTenantResponseDto })
  tenant!: PlatformTenantResponseDto;

  @ApiProperty({ type: UserResponseDto })
  adminUser!: UserResponseDto;
}
