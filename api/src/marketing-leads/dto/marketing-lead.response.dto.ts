import { ApiProperty } from '@nestjs/swagger';

export class MarketingLeadResponseDto {
  @ApiProperty({ example: 'mlead_1715860000000_ab12cd34' })
  id!: string;

  @ApiProperty({ example: 'Marketing lead received.' })
  message!: string;
}
