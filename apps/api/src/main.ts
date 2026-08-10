import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { validateSecurityEnv } from './config/security.config';

async function bootstrap() {
  const security = validateSecurityEnv(process.env);

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  configureApp(app, { security });

  // Allow Nest lifecycle (Prisma disconnect) on SIGTERM/SIGINT (Docker stop).
  app.enableShutdownHooks();

  const port = process.env.PORT ?? '3001';
  await app.listen(port);
}
void bootstrap();
