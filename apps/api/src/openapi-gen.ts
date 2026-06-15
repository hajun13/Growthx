import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from './app.module';

/** dist 구조·cwd 에 의존하지 않도록 pnpm-workspace.yaml 로 워크스페이스 루트를 찾는다. */
function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('워크스페이스 루트(pnpm-workspace.yaml)를 찾지 못했습니다.');
}

/**
 * OpenAPI 스펙(openapi.json) 발행 — packages/contracts 의 codegen 입력.
 * preview 모드로 생성해 DB 연결(PrismaService.onModuleInit $connect) 없이 메타데이터만 스캔한다.
 * 실행: nest build(swagger 플러그인 적용) 후 `node dist/openapi-gen.js`.
 */
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('에너지엑스 인사평가 API')
    .setDescription('모듈러 모놀리식 백엔드 — 응답 봉투 {data}/{data,meta}/{error}')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const root = findWorkspaceRoot(__dirname);
  const out = resolve(root, 'packages', 'contracts', 'openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(document, null, 2), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(
    `openapi.json 발행 완료: ${out} (paths=${Object.keys(document.paths ?? {}).length})`,
  );
  await app.close();
}

generate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('openapi 발행 실패:', err);
  process.exit(1);
});
