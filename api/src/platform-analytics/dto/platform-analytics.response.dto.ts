import { ApiProperty } from '@nestjs/swagger';

export class PlatformAnalyticsRangeDto {
  @ApiProperty()
  fromDate!: string;

  @ApiProperty()
  toDate!: string;
}

export class PlatformAnalyticsSummaryDto {
  @ApiProperty()
  totalAgencies!: number;

  @ApiProperty()
  activeAgencies!: number;

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
  openTickets!: number;

  @ApiProperty()
  newLeadsInPeriod!: number;

  @ApiProperty()
  convertedLeadsInPeriod!: number;

  @ApiProperty()
  leadConversionRatePercent!: number;

  @ApiProperty()
  publishedStorefronts!: number;

  @ApiProperty()
  agenciesWithRecentActivity!: number;
}

export class PlatformDailyTrendPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  reservations!: number;

  @ApiProperty()
  leads!: number;
}

export class PlatformTopAgencyDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  tenantName!: string;

  @ApiProperty()
  tenantSlug!: string;

  @ApiProperty()
  reservationsInPeriod!: number;

  @ApiProperty()
  activeUsers!: number;

  @ApiProperty()
  activeRides!: number;

  @ApiProperty()
  activeLines!: number;
}

export class PlatformAnalyticsResponseDto {
  @ApiProperty({ type: PlatformAnalyticsRangeDto })
  range!: PlatformAnalyticsRangeDto;

  @ApiProperty({ type: PlatformAnalyticsSummaryDto })
  summary!: PlatformAnalyticsSummaryDto;

  @ApiProperty({ type: [PlatformDailyTrendPointDto] })
  dailyTrend!: PlatformDailyTrendPointDto[];

  @ApiProperty({ type: [PlatformTopAgencyDto] })
  topAgencies!: PlatformTopAgencyDto[];
}
