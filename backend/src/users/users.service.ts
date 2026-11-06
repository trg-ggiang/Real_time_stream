import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { User } from './entities/user.entity';

const COLS = 'user_id,email,display_name,avatar_url,email_verified_at,created_at';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  private toUser(r: any): User {
    return {
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url ?? null,
      emailVerifiedAt: r.email_verified_at ? new Date(r.email_verified_at) : null,
      createdAt: new Date(r.created_at),
      passwordHash: r.password_hash,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select(COLS)
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('User data is temporarily unavailable.');
    return data ? this.toUser(data) : null;
  }

  // Lấy kèm password_hash (dùng cho login)
  async findByEmailWithPassword(email: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select(`${COLS},password_hash`)
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('User data is temporarily unavailable.');
    return data ? this.toUser(data) : null;
  }

  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select(COLS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('User data is temporarily unavailable.');
    return data ? this.toUser(data) : null;
  }

  async create(input: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase.client
      .from('users')
      .insert({
        email: input.email,
        display_name: input.displayName,
        password_hash: input.passwordHash,
      })
      .select(COLS)
      .single();

    if (error) {
      if (error.code === '23505') throw new ConflictException('Email đã được sử dụng');
      throw new InternalServerErrorException('User data is temporarily unavailable.');
    }
    return this.toUser(data);
  }
}