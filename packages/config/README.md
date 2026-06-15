# @growthx/config

공유 빌드/품질 설정 패키지. 여러 앱·패키지가 동일한 규칙을 쓰도록 한다(architecture.md §1·§3).

- **책임:** ESLint preset(AI 가독성 게이트 — 파일 200줄 상한). 디자인 토큰(Tailwind preset)은 `@growthx/ui` 소유.
- **공개 API:** `@growthx/config/eslint-preset.cjs`.
- **소유 데이터:** 없음(설정 전용).
- **의존:** 없음.
- **불변식:** 규칙은 경고(warn) 우선 — 빌드를 깨지 않되 초과를 드러낸다.

## 사용
```js
// 앱 .eslintrc.cjs
module.exports = {
  extends: ['next/core-web-vitals', require.resolve('@growthx/config/eslint-preset.cjs')],
};
```
```js
// 앱 tailwind.config.ts (Phase 3 토큰 이전 후)
presets: [require('@growthx/config/tailwind-preset.cjs')]
```

## 상태
- **Phase 2b(현재):** ESLint max-lines preset 제공. Tailwind preset 은 스텁(토큰은 아직 apps/web).
- **Phase 3:** Kinetic 토큰을 packages/ui 추출과 함께 tailwind-preset 으로 이전.
