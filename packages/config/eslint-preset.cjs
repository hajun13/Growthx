/**
 * 공유 ESLint preset — AI 가독성 게이트 (architecture.md §3).
 * 파일/함수 길이 상한을 강제해 "한 파일 = 한 책임, AI가 통째로 읽기 쉬운 크기"를 유지한다.
 * 경고(warn)로 두어 빌드를 깨지 않되, 리팩토링 시 초과 파일을 드러낸다.
 *
 * 사용: 앱의 ESLint 설정 extends 에 추가.
 *   // .eslintrc.cjs
 *   module.exports = { extends: ['next/core-web-vitals', require.resolve('@growthx/config/eslint-preset.cjs')] };
 */
module.exports = {
  rules: {
    // 파일당 ~200줄 상한 (주석·빈줄 제외). 250 초과 경고 — 넘으면 책임을 쪼갠다.
    'max-lines': [
      'warn',
      { max: 250, skipBlankLines: true, skipComments: true },
    ],
    // 함수 비대화 방지.
    'max-lines-per-function': [
      'warn',
      { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
  },
};
