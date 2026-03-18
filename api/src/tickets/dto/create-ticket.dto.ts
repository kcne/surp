import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Application crashes when opening reservation details' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: 'When opening reservation details page the UI freezes and request fails.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketCategory, default: TicketCategory.QUESTION })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;
}
