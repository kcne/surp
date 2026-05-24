import { ApiProperty } from '@nestjs/swagger';

export class PublicSeoSitemapAgencyDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class PublicSeoSitemapDataResponseDto {
  @ApiProperty({ type: [PublicSeoSitemapAgencyDto] })
  agencies!: PublicSeoSitemapAgencyDto[];
}
