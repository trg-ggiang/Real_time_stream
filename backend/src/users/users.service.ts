import {
  ConflictException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { User } from "./entities/user.entity";

const COLS =
  "user_id,email,display_name,avatar_url,role,email_verified_at,created_at";

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  private toUser(r: any): User {
    return {
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url ?? null,
      role: r.role ?? null,
      emailVerifiedAt: r.email_verified_at
        ? new Date(r.email_verified_at)
        : null,
      createdAt: new Date(r.created_at),
      passwordHash: r.password_hash,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from("users")
      .select(COLS)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error)
      throw new InternalServerErrorException(
        "User data is temporarily unavailable.",
      );
    return data ? this.toUser(data) : null;
  }

  // Lấy kèm password_hash (dùng cho login)
  async findByEmailWithPassword(email: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from("users")
      .select(`${COLS},password_hash`)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error)
      throw new InternalServerErrorException(
        "User data is temporarily unavailable.",
      );
    return data ? this.toUser(data) : null;
  }

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from("users")
      .select(COLS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new InternalServerErrorException(
        "User data is temporarily unavailable.",
      );
    return data ? this.toUser(data) : null;
  }

  async create(input: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase.client
      .from("users")
      .insert({
        email: input.email,
        display_name: input.displayName,
        password_hash: input.passwordHash,
      })
      .select(COLS)
      .single();

    if (error) {
      if (error.code === "23505")
        throw new ConflictException("Email đã được sử dụng");
      throw new InternalServerErrorException(
        "User data is temporarily unavailable.",
      );
    }
    return this.toUser(data);
  }

  async getProfile(userId: string) {
    const { data, error } = await this.supabase.client
      .from("student_profiles")
      .select(
        "user_id,full_name,student_code,school_or_faculty,major,cohort,phone,bio,created_at,updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new InternalServerErrorException(
        "Profile data is temporarily unavailable.",
      );
    return (
      data ?? {
        user_id: userId,
        full_name: null,
        student_code: null,
        school_or_faculty: null,
        major: null,
        cohort: null,
        phone: null,
        bio: null,
        created_at: null,
        updated_at: null,
      }
    );
  }

  async updateProfile(userId: string, input: object) {
    const clean = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() || null : value,
      ]),
    );
    const merged = { ...(await this.getProfile(userId)), ...clean };
    if (
      (
        [
          "full_name",
          "student_code",
          "school_or_faculty",
          "major",
          "cohort",
        ] as const
      ).some((key) => typeof merged[key] !== "string" || !merged[key].trim())
    ) {
      throw new BadRequestException(
        "Nhập đầy đủ họ tên, mã sinh viên, trường/khoa, ngành và khóa.",
      );
    }
    const { data, error } = await this.supabase.client
      .from("student_profiles")
      .upsert(
        { ...clean, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select(
        "user_id,full_name,student_code,school_or_faculty,major,cohort,phone,bio,created_at,updated_at",
      )
      .single();
    if (error?.code === "23505")
      throw new ConflictException("Mã sinh viên đã được sử dụng.");
    if (error?.code === "23514")
      throw new BadRequestException("Thông tin hồ sơ chưa hợp lệ.");
    if (error)
      throw new InternalServerErrorException(
        "Profile data is temporarily unavailable.",
      );
    return data;
  }
}
