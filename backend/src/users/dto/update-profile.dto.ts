import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) full_name?: string | null;
  @IsOptional() @IsString() @MaxLength(32) student_code?: string | null;
  @IsOptional() @IsString() @MaxLength(120) school_or_faculty?: string | null;
  @IsOptional() @IsString() @MaxLength(120) major?: string | null;
  @IsOptional() @IsString() @MaxLength(40) cohort?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string | null;
}
