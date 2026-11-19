import { IsObject, IsOptional, IsUrl, IsUUID, MaxLength } from "class-validator";

export class SubmitRecruitmentApplicationDto {
  @IsUUID() recruitment_department_id!: string;
  @IsObject() answers!: Record<string, unknown>;
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  portfolio_url?: string | null;
}
