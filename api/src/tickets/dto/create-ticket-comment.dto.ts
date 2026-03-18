import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTicketCommentDto {
  @ApiProperty({ example: 'We are investigating this issue and will update shortly.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}
