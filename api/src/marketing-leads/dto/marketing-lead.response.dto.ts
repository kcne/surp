import { ApiProperty } from '@nestjs/swagger';

export class MarketingLeadResponseDto {
  @ApiProperty({ example: 'clwm0k6q40000s60m5zg7n3c2' })
  id!: string;

  @ApiProperty({ example: 'Marketing lead received.' })
  message!: string;
}
