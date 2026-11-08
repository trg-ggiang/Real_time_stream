import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    methods: ['GET', 'POST'],
    credentials: true,
  });
  app.enableShutdownHooks();
}
