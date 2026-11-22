import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
export const fieldTypes=['short_text','paragraph','single_choice','checkboxes','dropdown','number','email','phone','date','file','rating'] as const;
export class RecruitmentQuery {
 @Type(()=>Number) @IsInt() @Min(1) @Max(10000) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(50) limit=12;
 @IsOptional() @IsString() @MaxLength(100) q?:string;
 @IsOptional() @IsIn(['all','submitted','accepted','rejected']) status='all';
 @IsOptional() @IsUUID() club_id?:string;
}
export class ManagedRecruitmentQuery extends RecruitmentQuery {
 @IsOptional() @IsIn(['all','open','closed','waiting']) campaign_status='all';
}
export class FormOption { @IsUUID() option_id!:string; @IsString() @MinLength(1) @MaxLength(500) label!:string; }
export class FormQuestion {
 @IsOptional() @IsUUID() field_id?:string;
 @IsString() @MinLength(1) @MaxLength(2000) question_text!:string;
 @IsOptional() @IsString() @MaxLength(2000) help_text?:string;
 @IsIn(fieldTypes) question_type!:typeof fieldTypes[number];
 @IsBoolean() is_required!:boolean;
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>FormOption) options:FormOption[]=[];
 @IsObject() validation:Record<string,unknown>={};
 @IsOptional() @IsIn(['full_name','student_code','email','phone','school_or_faculty','major','cohort']) profile_field?:string;
}
export class RecruitingDepartment {
 @IsUUID() department_id!:string;
 @IsString() @MinLength(1) @MaxLength(20000) description!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>FormQuestion) questions!:FormQuestion[];
}
export class CampaignInput {
 @IsString() @MinLength(2) @MaxLength(200) title!:string;
 @IsString() @MinLength(10) @MaxLength(50000) description!:string;
 @IsOptional() @IsString() @MaxLength(500) summary?:string;
 @IsOptional() @IsUrl({require_protocol:true,protocols:['https','http']}) @MaxLength(2048) cover_url?:string|null;
 @IsISO8601({strict:true}) application_opens_at!:string;
 @IsISO8601({strict:true}) application_closes_at!:string;
 @IsOptional() @IsISO8601() expected_updated_at?:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>RecruitingDepartment) departments!:RecruitingDepartment[];
}
export class CampaignVersion { @IsISO8601() expected_updated_at!:string; }
export class RecruitmentAnswer { @IsUUID() question_id!:string; @IsOptional() value:unknown; }
export class ApplicationInput {
 @IsUUID() recruitment_department_id!:string;
 @IsUUID() form_version_id!:string;
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>RecruitmentAnswer) answers!:RecruitmentAnswer[];
}
export class DecisionInput extends CampaignVersion {
 @IsBoolean() approve!:boolean;
 @IsOptional() @IsString() @MaxLength(5000) reason?:string;
}
export class UploadPurpose {
 @IsOptional() @IsISO8601() expected_updated_at?:string;
 @IsIn(['cover','answer']) purpose!:'cover'|'answer';
 @IsOptional() @IsUUID() question_id?:string;
}
