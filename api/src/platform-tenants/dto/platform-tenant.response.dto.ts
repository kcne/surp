import { ApiProperty } from '@nestjs/swagger';

export class PlatformTenantLoginOptionResponseDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class PlatformTenantResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

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
