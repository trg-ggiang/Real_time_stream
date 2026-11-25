import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const reportCategories = ['account', 'clubs', 'recruitment', 'meetings', 'content', 'other'] as const;
export const reportStatuses = ['new', 'in_progress', 'resolved', 'rejected'] as const;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateSupportReport {
  @IsUUID('4') report_id!: string;
  @IsIn(reportCategories) category!: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(20) @MaxLength(5000) description!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(3000) steps = '';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  @Matches(/^$|^\/(?!\/)[^?#\\\s]*$/) page_path = '';
  @IsIn(['normal', 'high']) priority = 'normal';
}

export class SupportReportQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) limit = 10;
  @IsIn(['all', ...reportStatuses]) status = 'all';
  @IsIn(['all', ...reportCategories]) category = 'all';
  @Transform(trim) @IsString() @MaxLength(100) q = '';
}

export class UpdateSupportReport {
  @IsIn(reportStatuses) status!: string;
  @IsIn(['normal', 'high']) priority!: string;
  @Transform(trim) @IsString() @MaxLength(3000) admin_response!: string;
  @IsISO8601() expected_updated_at!: string;
}
