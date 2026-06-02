# TDS(Toss Design System) — 디자인 언어 적용 가이드

이 프로젝트는 **TDS를 디자인 언어로 차용**하여 독립 데스크탑/반응형 웹 SaaS를 구축한다. 앱인토스(app-in-toss) 미니앱 플랫폼에 종속되지 않으며, `@apps-in-toss` 런타임 패키지를 쓰지 않는다. 대신 TDS의 시각 원칙(색·타이포·간격·라운드·컴포넌트 행동)을 **자체 디자인 토큰**으로 재현하여 Tailwind/CSS 변수로 구현한다.

> 출처: `인사 평가 시스템 참고용/components.md` (TDS 개요, 핵심 컴포넌트 11종). 상세는 https://developers-apps-in-toss.toss.im/design/components.md

## 라이선스 주의
TDS UI Kit/패키지의 직접 사용 권한은 앱인토스 서비스 범위로 제한된다. 따라서 본 프로젝트는 TDS **패키지를 임포트하지 않고**, 공개된 디자인 원칙을 참고해 **독자 토큰·컴포넌트**를 만든다. (디자인 언어 차용은 가능, 보호 자산 직접 사용은 회피)

## TDS 디자인 원칙 (차용)
- **명료함:** 한 화면에 한 가지 핵심 행동. 우하단 단일 주요 액션(Primary) 고정.
- **부드러움:** 큰 라운드(카드 12~16px), 충분한 여백, 가벼운 그림자.
- **친절한 라이팅:** "~해요" 체의 다정한 안내문, 코치마크로 다음 행동 유도.
- **일관성:** 상태·등급·차원의 색을 전역 토큰으로 단일화.

## 토큰 매핑 (자체 정의 → Tailwind)
디자이너가 `design-tokens.md`에 구체 수치를 확정한다. TDS 차용 기준:

| 토큰군 | 가이드 |
|--------|--------|
| Primary | 토스 블루 계열(신뢰·진행). 진행중 바·주요 링크에 사용 |
| Success/Accent | 그린 계열(완료·코치마크) |
| Warning/Danger | 가중치 합 초과·미완료·반려 |
| Neutral 50~900 | 텍스트·보더·배경 그레이 스케일 |
| Typo | Pretendard 등 한글 친화 산세리프. 크기 스케일 xs~3xl |
| Radius | sm 8 / md 12 / lg 16 / full |
| Spacing | 4px 기준 스케일 |
| Elevation | 카드 sm/md, 모달 lg |

**도메인 시맨틱 색(전역 고정):**
- 평가 상태: not_started(회색) / in_progress(블루) / submitted(인디고) / finalized(그린)
- 등급: S(딥블루)·A(블루)·B(그린)·C(앰버)·D(레드) — DistributionBarChart·GradeChip·ComparisonBar 공통

## 컴포넌트 행동 (TDS 차용 11종 대응)
TDS 핵심 컴포넌트의 행동 패턴을 자체 컴포넌트로 재현한다 (Button, TextField, Checkbox/Radio, Select, Switch, Badge, Card/ListRow, Tabs, Modal/BottomSheet, Toast, Top/NavBar 등). 인사평가 전용 컴포넌트(GradeRadio·DistributionBarChart·ComparisonBar 등)는 이 기본 위에 조합한다. 상세는 [reference-ui-screens.md](reference-ui-screens.md)의 컴포넌트 표.

## 반응형
- 데스크탑 우선(레퍼런스가 넓은 관리자 웹). 사이드바 고정.
- 태블릿/모바일: 사이드바 → 드로어, 3분할 평가 화면 → 세로 스택, 표 → 카드 리스트.
- 브레이크포인트: sm 640 / md 768 / lg 1024 / xl 1280.

## 접근성
- 명도 대비 AA 이상. 등급 색은 색만으로 구분하지 않고 라벨(S~D) 병기.
- 라디오/입력에 라벨 연결, 키보드 내비게이션.
