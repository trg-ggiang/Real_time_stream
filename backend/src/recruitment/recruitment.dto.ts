import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt,
  IsISO8601, IsObject, IsOptional, IsString, IsUrl, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from "class-validator";

export const questionTypes = ["short_text", "paragraph", "single_choice", "checkboxes", "dropdown", "number", "email", "phone", "date", "file", "rating"] as const;
export type QuestionType = typeof questionTypes[number];
export class RecruitmentPage {
  @IsOptional() @IsUUID() club_id?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(["all", "draft", "open", "closed", "completed", "cancelled"]) status = "all";
}
export class ApplicationPage {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(["all", "pending", "approved", "rejected"]) status = "all";
  @IsOptional() @IsIn(["newest", "oldest"]) sort = "newest";
}
export class CampaignDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(50000) description!: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(20000) benefits?: string;
  @IsOptional() @IsEmail() @MaxLength(320) contact_email?: string;
  @IsOptional() @IsString() @MaxLength(32) contact_phone?: string;
  @IsOptional() @IsUrl({ protocols: ["https", "http"], require_protocol: true }) @MaxLength(2048) cover_url?: string | null;
  @IsISO8601({ strict: true }) application_opens_at!: string;
  @IsISO8601({ strict: true }) application_closes_at!: string;
  @IsOptional() @IsISO8601() expected_updated_at?: string;
}
export class VersionDto {
  @IsISO8601() expected_updated_at!: string;
}
export class RecruitingDepartmentDto extends VersionDto {
  @IsUUID() department_id!: string;
  @IsString() @MinLength(1) @MaxLength(20000) description!: string;
  @IsOptional() @IsString() @MaxLength(20000) requirements?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) target_quantity?: number;
}
export class QuestionOptionDto {
  @IsUUID() option_id!: string;
  @IsString() @MinLength(1) @MaxLength(500) label!: string;
}
export class QuestionValidationDto {
  @IsOptional() @IsInt() @Min(0) @Max(10000) min_length?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) max_length?: number;
  @IsOptional() @Type(() => Number) @Min(-1e12) @Max(1e12) min?: number;
  @IsOptional() @Type(() => Number) @Min(-1e12) @Max(1e12) max?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) max_files?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5242880) max_size_bytes?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4)
  @IsIn(["application/pdf", "image/jpeg", "image/png", "image/webp"], { each: true }) allowed_mime_types?: string[];
}
export class QuestionDto {
  @IsOptional() @IsUUID() field_id?: string;
  @IsString() @MinLength(1) @MaxLength(2000) question_text!: string;
  @IsOptional() @IsString() @MaxLength(2000) help_text?: string;
  @IsIn(questionTypes) question_type!: QuestionType;
  @IsBoolean() is_required!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => QuestionOptionDto) options?: QuestionOptionDto[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => QuestionValidationDto) validation?: QuestionValidationDto;
  @IsOptional() @IsIn(["full_name", "student_code", "email", "phone", "school_or_faculty", "major", "cohort"]) profile_field?: string;
}
export class SaveFormDto extends VersionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => QuestionDto) questions!: QuestionDto[];
  @IsOptional() @IsBoolean() acknowledge_existing_applications = false;
}
export class AnswerDto {
  @IsUUID() question_id!: string;
  // Shape and type are validated against the exact server-side form version.
  @IsOptional() value: unknown;
}
export class SubmitApplicationDto {
  @IsUUID() recruitment_department_id!: string;
  @IsUUID() form_version_id!: string;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AnswerDto) answers!: AnswerDto[];
}
export class DecisionDto extends VersionDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(5000) reason?: string;
  @IsOptional() @IsUUID() department_id?: string;
}
export class BulkDecisionItem extends VersionDto {
  @IsUUID() application_id!: string;
}
export class BulkDecisionDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(5000) reason?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => BulkDecisionItem) applications!: BulkDecisionItem[];
}
export class FilePurposeDto {
  @IsIn(["answer", "cover"]) purpose!: "answer" | "cover";
  @IsOptional() @IsUUID() question_id?: string;
  @IsOptional() @IsISO8601() expected_updated_at?: string;
}
