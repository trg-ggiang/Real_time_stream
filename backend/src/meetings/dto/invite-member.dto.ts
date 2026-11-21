import { IsEmail, MaxLength } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
