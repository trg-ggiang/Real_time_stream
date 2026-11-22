import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
export class AdminListQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(8) limit = 8;
  @IsIn(["all", "pending", "published", "rejected", "suspended", "archived"])
  status = "all";
  @IsOptional() @IsString() @MaxLength(100) q = "";
  @IsIn(["requests", "directory"]) scope = "requests";
}
export class AdminDecisionDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsISO8601() expected_updated_at!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) reason?: string;
}

export class AdminDirectoryQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(8) limit = 8;
  @IsOptional() @IsString() @MaxLength(100) q = '';
  @IsIn(['all', 'admin', 'user']) role = 'all';
  @IsIn(['posts', 'activities']) kind = 'posts';
  @IsIn(['all', 'draft', 'pending_review', 'published', 'rejected', 'changes_requested', 'archived']) status = 'all';
}
