---
name: wireframe-to-design
description: "인사평가/HR 솔루션의 와이어프레임, Kinetic Enterprise(루트 DESIGN.md) 기반 UI 디자인 시스템, 디자인 토큰, 컴포넌트 스펙을 설계. 화면 흐름·레이아웃 설계, 색/타이포/간격 토큰 정의, 컴포넌트 명세 작성 시 사용. 평가 일정 캘린더, 본인/부서장 평가 화면, 등급 분포, 결과 비교 리포트, 규칙 설정 화면 등 인사평가 화면을 설계하거나 디자인을 수정·보완·다시 설계·재스킨할 때 반드시 사용."
---

# 와이어프레임 → Kinetic Enterprise 디자인 시스템

인사평가 솔루션의 화면을 요구사항에서 출발해 **구현 가능한** 디자인 스펙까지 단계적으로 설계하는 스킬. 추상적 무드보드가 아니라 frontend-engineer가 그대로 구현할 수 있는 토큰·치수·상태를 산출한다.

## 자료 우선순위 (먼저 읽는다)
- **권위(따라야 할 기준):** 운영계획 PPT + `domain-model.md`(역할·직책·KPI 분류·평가 유형) + `business-rules.md`(규칙). 화면이 표현할 *내용·규칙*은 여기서 나온다.
- **시각 언어(권위·SSOT):** 루트 **`DESIGN.md` (Kinetic Enterprise)** — 팔레트(퍼플/블루/틸)·타이포(기본 글꼴 Pretendard)·8px rounded·그림자·컴포넌트 규칙 + 하단 "프로젝트 적용 노트"(글꼴·등급 색 파생·데이터 밀도 보정).
- **코드 구조(SSOT):** `architecture.md` §5 — 토큰·공용 프리미티브는 **여러 서비스가 공유하는 `packages/ui`** 로 향한다(앱 비종속). 화면별 조립은 `features/*`. 현행 Phase 1은 `apps/web`, 목표는 `packages/ui`.
- **참고용(advisory):** `reference-ui-screens.md` + 원본 스크린샷(`인사 평가 시스템 참고용/레퍼런스 솔루션 이미지/*.png`) — 레이아웃·컴포넌트 *아이디어 참고만*. 그대로 베끼지 말고 에너지엑스 도메인에 맞게 재구성. PPT/도메인과 충돌하면 권위 자료가 이긴다.

## 절차

### 1. 화면 인벤토리 (와이어프레임)
`reference-ui-screens.md`의 화면 세트(S1~S8)를 *아이디어*로 참고하되, 우리 도메인 화면을 도출한다: 전역 레이아웃(상단탭+좌측 사이드바), 인사평가 메인(주차별 일정 캘린더), 본인정보 확인, 본인평가(KPI 2그룹: 성과중심/협업·성장 탭 — 역량 탭 없음), 부서장 평가(downward 3단계: 팀장·본부장·그룹대표, 분포 차트), 평가 상세결과(self+downward 단계별 비교), 관리자 설정(규칙·양식·일정). **레퍼런스의 역량 탭·다면평가 목록은 타사 구조이므로 채택하지 않는다.**

각 화면에 대해: 목적 · 진입 경로 · 핵심 컴포넌트 · 역할별 차이 · 빈/로딩/에러/권한없음 상태를 명시한다. 레이아웃은 마크다운 박스 다이어그램으로 표현. 레퍼런스 화면을 기준 삼되 요구사항에 맞게 가감한다.

### 2. 정보 구조 & 흐름
- 내비게이션(상단탭 + 좌측 사이드바)과 역할별 메뉴 가시성을 `business-rules.md` RBAC 매트릭스에 맞춘다 (hr_admin/division_head/team_lead/employee).
- 사이드바는 Kinetic Enterprise 스펙: **Primary Purple(`#564599`) 배경 + 활성 항목 좌측 4px Teal 바 + 흰 텍스트 하이라이트**.
- 핵심 평가 플로우: `평가준비 → 본인평가 → 1차 팀장 → 2차 본부장 → 최종 그룹대표 → 결과·캘리브레이션`.

### 3. 디자인 토큰 (Kinetic Enterprise — DESIGN.md에서 도출)
루트 `DESIGN.md`의 frontmatter 토큰을 그대로 옮기고, 도메인 시맨틱만 파생해 추가한다. frontend가 Tailwind/CSS 변수로 바로 옮길 수 있는 값으로:

```
색상:    primary(딥 퍼플 #3f2c80, 사이드바 #564599) / secondary(블루 #0054ca — 주요 액션·링크·진행)
         tertiary(틸 — 데이터 시각화·성공) / error(#ba1a1a) / surface 계열(#f8f9fd 배경, #ffffff 카드)
         + 평가 상태 색 (not_started/in_progress=secondary/submitted/finalized=tertiary)
         + 등급 시맨틱 색 (S 퍼플·A 블루·B 틸·C 앰버[팔레트 외 보완]·D 에러 — DESIGN.md 적용 노트의 파생표)
타이포:  Pretendard 단일 패밀리 (헤드라인·본문·라벨 공통 — 위계는 크기·굵기로만)
         display-lg 48 / headline-lg 32 / headline-md 24 / body-md 16 / label-md 14 / label-sm 12
         데이터 고밀도 화면은 label-md/sm을 본문급으로 사용 가능 (적용 노트 §2)
간격:    4px 단위, gutter 24, stack 8/16/32, 카드 내부 패딩 24
반경:    sm 4 / DEFAULT 8 / md 12 / lg 16 / full(Pill — 뱃지·검색바). 카드·버튼·입력은 8px
그림자:  Level1 카드 0 4px 12px rgba(86,69,153,0.05) / Level2 모달 0 12px 24px rgba(0,0,0,0.08)
브레이크포인트: sm 640 / md 768 / lg 1024 / xl 1280, 컨테이너 max 1440 (데스크탑 우선)
```

값은 키-값 표로 구체 수치를 적는다 (예: `secondary: #0054ca`). 등급 색은 항상 색+텍스트 라벨 병기(대비 AA).

### 4. 컴포넌트 스펙
`reference-ui-screens.md`의 공통 컴포넌트 표를 명세화한다. 인사평가 핵심 컴포넌트:

| 컴포넌트 | props | 상태/변형 |
|----------|-------|----------|
| AppShell | role | 역할별 사이드바 메뉴 가시성. 퍼플 사이드바+틸 활성 바 |
| WeekScheduleCalendar | phases[], weekRange | 단계 바·상태 배지 |
| GradeRadio | value(S~D), readOnly | 부서장 평가의 등급 부여용. 미평가/선택/읽기전용 |
| GradeChip | grade | S~D 시맨틱 색, Pill 형태 |
| WeightField | value, total, group | 합계 100 검증(초과 danger), KPI 그룹(성과중심/협업·성장)별 |
| ScoreCard | score, achievementRate, measureType | 과제 최종점수(measureType별 달성률/건수 표시) |
| ProgressDonut | done, total | 완료율 % |
| DistributionBarChart | counts(S~D), avg, stddev | 등급 분포 |
| ComparisonBar | byType(self/d1/d2/d3), companyAvg | self+downward 단계별(팀장·본부장·그룹대표) 비교 + 전사평균 마커 |
| ProcessFlow | steps[], current | 평가 프로세스 흐름 |
| EvidenceUpload | maxSize, accept | 증빙 첨부 |
| CommentThread | comments[] | 작성자·분기 |
| StatusBadge | status | 진행중/완료/미완료 — Pill, 긍정은 틸 10% bg+100% text |
| Coachmark | text, next | 온보딩 안내 |

각 컴포넌트에 상태·반응형 동작·접근성(라벨, 등급 색+텍스트 병기, 대비 AA)을 명시.

## 작성 원칙
- **구현 가능성 우선:** 모든 토큰은 수치, 모든 컴포넌트는 props·상태가 명시돼야 한다.
- **역할 분기 명시:** 화면마다 hr_admin/division_head/team_lead/employee가 보는 차이를 적는다.
- **상태 누락 금지:** 빈/로딩/에러/권한없음 상태를 화면마다 정의 (프론트가 빠뜨리지 않도록).
- **도메인 일관:** 평가 유형·상태·등급 명칭은 `domain-model.md`를 따른다.

## 산출물
- `_workspace/01_design/wireframes.md` — 화면 인벤토리 + 레이아웃 + 흐름
- `_workspace/01_design/design-tokens.md` — 토큰 표 (Tailwind/CSS 변환 가능)
- `_workspace/01_design/component-spec.md` — 컴포넌트 명세

frontend-engineer가 이 세 파일을 입력으로 구현하므로, 토큰명·컴포넌트명을 프론트 구현과 일치시킨다.
