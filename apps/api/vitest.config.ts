import { defineConfig } from 'vitest/config';

// NestJS 데코레이터가 붙은 파일은 테스트하지 않는다(순수 함수만 대상).
// esbuild 로 트랜스파일하므로 emitDecoratorMetadata 가 필요 없다.
export default defineConfig({
  test: {
    // prisma/ 도 포함한다 — 운영 스크립트(preflight, seed)의 순수 함수가 여기 산다.
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts'],
    environment: 'node',
    globals: false,
  },
});
