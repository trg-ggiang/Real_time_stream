import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

class RecruitmentQuestionDto {
  @IsUUID("4") question_id!: string;
  @IsString() @MinLength(1) @MaxLength(2000) question_text!: string;
  @IsOptional() @IsString() @MaxLength(2000) help_text?: string;
  @IsBoolean() is_required!: boolean;
  @IsInt() @Min(1) @Max(10000) max_length!: number;
}
class RecruitmentDepartmentDto {
  @IsUUID("4") recruitment_department_id!: string;
  @IsUUID() department_id!: string;
  @IsString() @MinLength(1) @MaxLength(5000) description!: string;
  @IsString() @MinLength(1) @MaxLength(5000) requirements!: string;
  @IsInt() @Min(1) @Max(1000) target_quantity!: number;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => RecruitmentQuestionDto)
  questions!: RecruitmentQuestionDto[];
}
export class PublishRecruitmentDto {
  @IsUUID("4") campaign_id!: string;
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsISO8601() application_opens_at!: string;
  @IsISO8601() application_closes_at!: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(2048) cover_url?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RecruitmentDepartmentDto)
  departments!: RecruitmentDepartmentDto[];
}

export class RecruitmentApplicationReviewDto {
  @IsIn(["submitted", "interviewing", "accepted", "rejected"])
  status!: "submitted" | "interviewing" | "accepted" | "rejected";

  @IsOptional() @IsInt() @Min(0) @Max(100)
  score?: number | null;

  @IsOptional() @IsString() @MaxLength(5000)
  internal_note?: string | null;

  @IsOptional() @IsString() @MaxLength(5000)
  feedback?: string | null;
}
