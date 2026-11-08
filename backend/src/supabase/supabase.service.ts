import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY');
    const serverFetch: typeof fetch = (input, init) => {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, name) => headers.set(name, value));

      // New sb_secret keys authenticate through apikey and are not JWT bearer tokens.
      if (
        secretKey.startsWith('sb_secret_') &&
        headers.get('Authorization') === `Bearer ${secretKey}`
      ) {
        headers.delete('Authorization');
      }

      return fetch(input, { ...init, headers });
    };

    this.client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: serverFetch },
    });
  }
}
