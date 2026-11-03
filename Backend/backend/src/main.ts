import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './config/env.validation.js';

async function bootstrap() {
  validateEnv();

  const { AppModule } = await import('./app.module.js');
  const { configureApp } = await import('./app.setup.js');
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
