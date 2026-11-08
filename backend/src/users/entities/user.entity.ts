export class User {
  userId!: string;
  email!: string;
  displayName!: string;
  avatarUrl!: string | null;
  emailVerifiedAt!: Date | null;
  createdAt!: Date;
  passwordHash?: string | null; // chỉ có khi lấy riêng cho login
}