# 01 — 로그인 → 대시보드 진입

**Seed:** e2e/tests/seed.spec.ts
**Starting state:** global.setup (JWT storageState) 주입으로 test@energyx.co.kr / hr_admin 이미 인증됨.

---

## Happy Path: 인증된 사용자 대시보드 진입

### Steps
1. `page.goto('/')` — 앱 루트로 이동한다.
2. URL이 `/login`을 포함하지 않음을 확인한다. (로그인 페이지로 튕기지 않음)
3. `<body>` 가 보임을 확인한다.
4. 사이드바(AppShell)가 렌더됐는지 확인한다 — 상단에 "에너지엑스 인사 평가" 텍스트/로고 영역 visible.
5. 상단 헤더에 알림 벨 아이콘이 보임을 확인한다.
6. "안녕하세요, 김테스트" 인삿말이 visible임을 확인한다.
7. "나의 평가 진행 상황" 섹션이 visible임을 확인한다.
8. 5단계 StepCard — KPI 작성 / 본인평가 / 팀장 평가 / 본부장 평가 / 최종 평가 — 모두 visible.
9. "내 KPI 달성률" 카드가 visible.
10. "평가 일정" 카드가 visible.
11. "바로가기" 섹션의 KPI 작성 / 본인평가 / 내 평가표 / 평가결과 버튼이 visible.

**Success criteria:** URL에 `/login` 없음; "나의 평가 진행 상황" 섹션·바로가기 버튼 visible.
**Failure criteria:** `/login` 리다이렉트; 빈 화면/ErrorState 렌더.

---

## Negative: 비인증 상태에서 보호 경로 직접 접근

### Steps
1. localStorage의 `gx.accessToken` / `gx.refreshToken` / `gx.user` 키를 모두 제거한다.
2. `page.goto('/dashboard')` 로 직접 이동한다.
3. URL이 `/login`으로 리다이렉트됨을 확인한다.
4. 로그인 폼(이메일 입력, 비밀번호 입력, "로그인" 버튼)이 visible.
5. 사이드바가 렌더되지 않음을 확인한다.

**Success criteria:** `/login` 리다이렉트, 로그인 폼 visible.

---

## Edge: 바로가기 이동

### Steps
1. 인증 상태로 대시보드 진입.
2. 바로가기 "본인평가" 버튼 클릭 → URL이 `/eval/self`로 이동.
3. 브라우저 뒤로가기 → 대시보드 URL로 복귀.
