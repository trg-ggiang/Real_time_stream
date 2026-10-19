import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app);
  await app.listen(
    config.getOrThrow<number>('PORT'),
    config.getOrThrow<string>('HOST'),
  );
  Logger.log('API is ready. Health endpoint: /api/health', 'Bootstrap');
}

void bootstrap().catch(() => {
  // Do not dump process environment or SDK errors containing credentials.
  Logger.error(
    'API startup failed. Check port availability and environment configuration.',
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
