import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';

export class AddCampaignDto {
  @ApiProperty({
    example: ['b1f2c3d4-...', 'e5f6a7b8-...'],
    description: 'One or more campaign IDs to add to the existing vendor. Multiple campaigns are bundled into a single new IO.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  campaign_ids: string[];

  @ApiPropertyOptional({ example: 'Special payout terms for these added campaigns...' })
  @IsOptional() @IsString()
  special_terms?: string;
}

export class ApproveDto {
  @ApiPropertyOptional({ example: 'Strong SEO background, approved for auto insurance' })
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Additional terms for this vendor...' })
  @IsOptional() @IsString()
  special_terms?: string;
}

export class RejectDto {
  @ApiProperty({
    example: 'traffic_type',
    enum: ['traffic_type', 'low_volume', 'compliance', 'duplicate', 'other'],
  })
  @IsString()
  @IsIn(['traffic_type', 'low_volume', 'compliance', 'duplicate', 'other'])
  reason: string;

  @ApiPropertyOptional({ example: 'We only accept organic traffic sources for this campaign' })
  @IsOptional() @IsString()
  details?: string;
}

export class SignIODto {
  @ApiProperty({ example: 'John Smith', description: 'Legal name for signature' })
  @IsString()
  sign_name: string;

  @ApiProperty({ example: true, description: 'Must agree to IO terms' })
  @IsBoolean()
  agree: boolean;
}
