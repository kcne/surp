import { ApiProperty } from '@nestjs/swagger';

export class PlatformTenantLoginOptionResponseDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class PlatformTenantStorefrontSummaryDto {
  @ApiProperty({ nullable: true })
  status!: string | null;

  @ApiProperty({ nullable: true })
  publishedAt!: Date | null;
}

export class PlatformTenantKpiResponseDto {
  @ApiProperty()
  totalUsers!: number;

  @ApiProperty()
  activeUsers!: number;

  @ApiProperty()
  reservationsInPeriod!: number;

  @ApiProperty()
  activeRides!: number;

  @ApiProperty()
  activeLines!: number;

  @ApiProperty()
  totalPassengers!: number;

  @ApiProperty()
  activePassengers!: number;

  @ApiProperty()
  openTickets!: number;

  @ApiProperty()
  inProgressTickets!: number;

  @ApiProperty({ type: () => PlatformTenantStorefrontSummaryDto })
  storefront!: PlatformTenantStorefrontSummaryDto;

  @ApiProperty({ nullable: true })
  lastActivityAt!: Date | null;
}

export class PlatformTenantResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  timezone!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  deactivatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deactivatedById!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: () => PlatformTenantKpiResponseDto, required: false })
  kpis?: PlatformTenantKpiResponseDto;
}

export class PaginatedPlatformTenantsResponseDto {
  @ApiProperty({ type: [PlatformTenantResponseDto] })
  items!: PlatformTenantResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  total!: number;
}
