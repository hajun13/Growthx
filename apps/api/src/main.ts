import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new EnvelopeInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors();

  // Swagger UI — 라이브 API 문서. openapi-gen.ts 와 동일한 DocumentBuilder 설정.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('에너지엑스 인사평가 API')
    .setDescription('모듈러 모놀리식 백엔드 — 응답 봉투 {data}/{data,meta}/{error}')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`인사평가 API listening on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
