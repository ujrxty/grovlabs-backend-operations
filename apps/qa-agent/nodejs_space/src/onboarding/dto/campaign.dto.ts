import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Auto Insurance RTB' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Insurance' })
  @IsString()
  industry: string;

  @ApiProperty({ example: 'Inbound Calls' })
  @IsString()
  call_type: string;

  @ApiPropertyOptional({ example: 'High-intent auto insurance calls from consumers actively shopping for quotes' })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ example: 25.00 })
  @IsNumber()
  payout: number;

  @ApiProperty({ example: 'per_conversion', enum: ['per_conversion', 'per_call', 'per_qualified_call'] })
  @IsString()
  payout_type: string;

  @ApiPropertyOptional({ example: 'weekly', enum: ['weekly', 'biweekly', 'monthly'] })
  @IsOptional() @IsString()
  billing_cycle?: string;

  @ApiPropertyOptional({ example: 120, description: 'Minimum qualifying call duration in seconds' })
  @IsOptional() @IsInt()
  min_duration?: number;

  @ApiPropertyOptional({ example: 'Nationwide' })
  @IsOptional() @IsString()
  geographic_focus?: string;

  @ApiPropertyOptional({ example: 'SEO, PPC, Social Media, Radio' })
  @IsOptional() @IsString()
  allowed_traffic?: string;

  @ApiPropertyOptional({ example: 'Robocalls, Cold Transfers, Auto-dialers' })
  @IsOptional() @IsString()
  restricted_traffic?: string;

  @ApiPropertyOptional({ example: 'Must have experience with insurance calls' })
  @IsOptional() @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'All calls must comply with TCPA and state DNC regulations' })
  @IsOptional() @IsString()
  compliance_notes?: string;

  @ApiPropertyOptional({ description: 'Default IO terms template for this campaign' })
  @IsOptional() @IsString()
  terms_template?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class UpdateCampaignDto extends CreateCampaignDto {
  // All fields optional for updates
}
