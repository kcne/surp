import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class AssignReservationGroupDto {
  @ApiProperty({ type: [String], minItems: 2, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  reservationIds!: string[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;
}
