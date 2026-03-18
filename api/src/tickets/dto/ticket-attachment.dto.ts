import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateTicketAttachmentPresignDto {
  @ApiProperty({ example: 'screenshot-issue.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 345612 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CompleteTicketAttachmentDto {
  @ApiProperty({ example: 'tenants/tenant-id/tickets/ticket-id/uuid-screenshot-issue.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  storageKey!: string;

  @ApiProperty({ example: 'screenshot-issue.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 345612 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class TicketAttachmentPresignResponseDto {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds!: number;
}

export class TicketAttachmentDownloadResponseDto {
  @ApiProperty()
  downloadUrl!: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds!: number;
}
