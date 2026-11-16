import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateClubDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(300) summary!: string;
  @IsString() @MinLength(20) @MaxLength(5000) description!: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(2000) mission?: string;
  @IsOptional() @IsEmail() @MaxLength(254) contact_email?: string;
  @IsOptional() @IsString() @MaxLength(32) contact_phone?: string;
  @IsOptional() @IsString() @MaxLength(2048) logo_url?: string;
  @IsOptional() @IsString() @MaxLength(2048) cover_url?: string;
}
