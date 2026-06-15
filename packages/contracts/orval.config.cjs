/**
 * orval codegen — 발행된 openapi.json → 타입 + fetch 클라이언트.
 * client: 'fetch' (react-query 신규 도입 없이 기존 훅 스타일 유지), 봉투/인증은 mutator 에서.
 * 실행: pnpm -C packages/contracts run generate (openapi.json 갱신 후).
 */
module.exports = {
  api: {
    input: { target: './openapi.json' },
    output: {
      mode: 'tags-split',
      target: './src/generated',
      schemas: './src/generated/model',
      client: 'fetch',
      clean: true,
      prettier: false,
      override: {
        mutator: { path: './src/mutator.ts', name: 'customFetch' },
      },
    },
  },
};
