/**
 * @shadcn/lint 앵커 — 동작 없음(no-op) Tailwind 플러그인.
 *
 * @shadcn/lint(0.2.x)는 테마 CSS 에 `@plugin`/`@config` 가 있을 때만 Tailwind 디자인시스템 오라클로
 * `text-*` 를 "글자색 vs font-size" 로 판정한다. 없으면 `@theme { --text-12: 12px }` 로 선언한 px 토큰
 * (`text-12`, `text-11h` …)을 "미선언 글자색"으로 오탐한다. 이 파일을 `theme.css` 가 `@plugin` 으로 로드해
 * 오라클 경로를 켠다. 삭제하지 말 것(삭제 시 lint 가 text-12 류를 전부 에러로 보고).
 */
module.exports = function energyxLintAnchor() {};
