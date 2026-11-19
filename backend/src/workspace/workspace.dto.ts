import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
export class WorkspacePage {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(24) limit = 12;
  @IsOptional() @IsUUID() department_id?: string;
}
export class ContentQuery extends WorkspacePage {
  @IsIn(["published", "mine", "review"]) list: "published" | "mine" | "review" =
    "published";
}
export class DepartmentDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsBoolean() is_private!: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() is_management?: boolean;
  @IsIn(["active", "inactive"]) status: "active" | "inactive" = "active";
}
export class MemberSearchQuery {
  @IsString() @MinLength(2) @MaxLength(100) q!: string;
}
export class AddMemberDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsUUID() department_id!: string;
  @IsIn(["member", "head"]) role: "member" | "head" = "member";
}
export class MoveMemberDto {
  @IsUUID() department_id!: string;
}
export class TransferDto {
  @IsUUID() membership_id!: string;
}
export class ContactDto {
  @IsOptional() @IsEmail() @MaxLength(320) contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(32) contact_phone?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  logo_url?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  cover_url?: string | null;
}
export class ContentVersion {
  @IsISO8601() expected_updated_at!: string;
}
export class ReviewDto extends ContentVersion {
  @IsIn(["published", "changes_requested"]) decision!:
    "published" | "changes_requested";
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class PostDraftDto {
  @IsUUID("4") post_id!: string;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(500) summary!: string;
  @IsString() @MinLength(10) @MaxLength(50000) content!: string;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  cover_url?: string | null;
  @IsIn(["public"]) visibility: "public" = "public";
  @IsOptional() @IsISO8601() expected_updated_at?: string;
}
export class ActivityDraftDto {
  @IsUUID("4") activity_id!: string;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(500) summary!: string;
  @IsString() @MinLength(10) @MaxLength(50000) description!: string;
  @IsISO8601() starts_at!: string;
  @IsISO8601() ends_at!: string;
  @IsIn(["onsite", "online", "hybrid"]) format!: "onsite" | "online" | "hybrid";
  @IsOptional() @IsString() @MaxLength(200) location_name?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) location_address?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  join_url?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  cover_url?: string | null;
  @IsOptional() @IsISO8601() registration_opens_at?: string | null;
  @IsOptional() @IsISO8601() registration_closes_at?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) capacity?: number | null;
  @IsOptional() @IsISO8601() expected_updated_at?: string;
}
