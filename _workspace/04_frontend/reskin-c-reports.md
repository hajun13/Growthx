# 재스킨 C — 리포트·실적 페이지 완료 노트

## 담당 파일 (5개)

| 파일 | 상태 | 주요 변경 |
|------|------|----------|
| `app/(main)/reports/page.tsx` | 완료 | K 팔레트·CARD_SHADOW 추가, 탭 rounded-xl 세그먼트, SummaryCard 28px 수치, 등급 배지 pill(borderRadius:999), 차트 K.secondary 색 |
| `app/(main)/reports/evaluation-summary/page.tsx` | 완료 | 카드·th/td K 스타일, 필터바 rounded-xl, 검색창 rounded-full pill, 등급 칩 rounded-xl 흰 카드, 컬럼 그룹 rgba 틴트(1차/2차/최종) |
| `app/(main)/reports/yoy/YoyComparePage.tsx` | 완료 | 탭 세그먼트 #f2f3f7 bg + rounded-xl/lg, K 색상 |
| `app/(main)/reports/yoy/OrgDistributionPanel.tsx` | 완료 | 조직 범위 토글 Kinetic 세그먼트, YoyStatCard accent T→K 리터럴 |
| `app/(main)/reports/yoy/PersonTimelinePanel.tsx` | 완료 | YoyStatCard accent T.grey900→#191c1f, T.green500→#0e9aa0, T.red500→#F44336 |
| `app/(main)/admin/monthly-performance/page.tsx` | 완료 | rateColor K.tertiary/K.secondary, StatCard rounded-xl, AreaChart K.secondary, 인풋 rounded-lg focus, SectionHead K.surfaceLow, 저장버튼 K.secondary |
| `app/(main)/admin/group-performance/page.tsx` | 완료 | 섹션1(그룹실적) 카드 K, 섹션2(등급풀) 카드+행 K rounded-xl/full, 섹션3(파이) 카드 K 툴팁, 섹션4(DeptGradeTable) K rounded-xl 탭버튼 K.secondary 활성 |

## 설계 결정

- `K` 상수 패턴(`const K = { primary:'#3f2c80', ... } as const`)을 각 파일 상단에 선언 — dashboard 레퍼런스 동일 패턴
- `CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)'` — 보라 틴트 소프트 그림자
- `T` import는 유지(gradeChipColor·categoryChip 공개 API), 색 값만 K로 우선 적용
- 등급 배지: `borderRadius:999` pill 형태로 통일
- 차트 계열색: K.secondary(#0054ca) 주 계열, K.tertiary(#0e9aa0) 성공/상승, #f57800 경고/하락
- 로직·훅·API 배선·RBAC·상태 분기 불변 — 시각 레이어만 교체

## tsc 결과

Area C 파일 오류: **0건**

- 전체 프로젝트에 `admin/permissions/page.tsx` 유니코드 문자 오류 존재하나 해당 파일은 에이전트 D 담당(범위 외, 미수정)
