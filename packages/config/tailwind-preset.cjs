/**
 * 공유 Tailwind preset — Kinetic Enterprise 토큰의 미래 공유 지점 (DESIGN.md SSOT).
 *
 * 현행(Phase 2b): 스텁. 실제 Kinetic 토큰(퍼플/블루/틸·반경·그림자)은 아직 apps/web/tailwind.config.ts 에 있다.
 * 목표(Phase 3): packages/ui 디자인 시스템 추출 시 토큰을 이 preset 으로 옮기고, apps 는
 *   `presets: [require('@growthx/config/tailwind-preset.cjs')]` 로 공유한다(앱별 토큰 중복 정의 금지).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {},
  },
};
