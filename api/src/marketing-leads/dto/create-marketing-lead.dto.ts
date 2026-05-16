import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const agencySizes = ['1-5', '6-20', '21-50', '50+'] as const;

export class CreateMarketingLeadDto {
  @ApiProperty({ example: 'Petar Petrovic' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'petar@example.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'Drina Bus' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  agencyName!: string;

  @ApiPropertyOptional({ example: '+381 64 123 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @ApiProperty({
    enum: agencySizes,
    example: '6-20',
    description: 'Approximate number of departures per day.'
  })
  @IsIn(agencySizes)
  departuresPerDay!: (typeof agencySizes)[number];

  @ApiPropertyOptional({ example: 'Zelimo online rezervacije za sezonske polaske.' })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  message?: string;

  @ApiPropertyOptional({
    description: 'Honeypot anti-spam field. Must be empty for real users.',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;
}
