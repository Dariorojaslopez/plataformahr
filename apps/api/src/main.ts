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

  await app.listen(process.env.PORT ?? '3001');
}
void bootstrap();
