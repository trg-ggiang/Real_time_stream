import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import {
  static as serveStatic,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

export function configureFrontend(
  app: INestApplication,
  config: Pick<ConfigService, 'get'>,
  frontendDistPath = resolve(__dirname, '../../frontend/dist'),
): void {
  if (config.get<string>('NODE_ENV') !== 'production') return;

  const indexPath = resolve(frontendDistPath, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('Frontend build is missing. Build the frontend before starting production.');
  }

  app.use(serveStatic(frontendDistPath, { index: false }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.method !== 'GET' ||
      request.path === '/api' ||
      request.path.startsWith('/api/') ||
      !request.accepts('html')
    ) {
      next();
      return;
    }

    response.sendFile(indexPath);
  });
}
