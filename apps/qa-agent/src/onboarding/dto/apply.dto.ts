import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsArray, IsBoolean, IsOptional, ArrayMinSize, IsNotEmpty } from 'class-validator';

export class ApplyDto {
  @ApiProperty({ example: 'Acme Media Group' })
  @IsString() @IsNotEmpty()
  company_name: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString() @IsNotEmpty()
  contact_name: string;

  @ApiProperty({ example: 'john@acmemedia.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '555-123-4567' })
  @IsString() @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'https://acmemedia.com' })
  @IsOptional() @IsString()
  website?: string;

  @ApiProperty({ example: 'SEO, PPC, Social Media' })
  @IsString() @IsNotEmpty()
  traffic_types: string;

  @ApiPropertyOptional({ example: '50-100 calls/day' })
  @IsOptional() @IsString()
  estimated_volume?: string;

  @ApiPropertyOptional({ example: '3 years in performance marketing, focused on insurance verticals' })
  @IsOptional() @IsString()
  experience?: string;

  @ApiPropertyOptional({ example: 'Mike at XYZ Corp' })
  @IsOptional() @IsString()
  referred_by?: string;

  @ApiPropertyOptional({ example: 'Looking to run auto insurance and roofing campaigns' })
  @IsOptional() @IsString()
  comments?: string;

  @ApiProperty({ description: 'Campaign IDs to apply for', example: ['uuid-1', 'uuid-2'] })
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  campaign_ids: string[];

  @ApiProperty({ description: 'Must agree to TCPA compliance', example: true })
  @IsBoolean()
  tcpa_agreed: boolean;

  @ApiProperty({ description: 'Must agree to terms and conditions', example: true })
  @IsBoolean()
  terms_agreed: boolean;
}
