# 사용자 매뉴얼 캡처 하네스

1920×1080 화면 캡처 + 번호 콜아웃 + 설명 표로 **역할별** 사용자 매뉴얼을 만든다.
산출물은 `docs/manual/employee.md`(구성원)와 `docs/manual/team-lead.md`(팀장).

관리자(hr_admin) 매뉴얼은 만들지 않는다 — 실제 독자는 구성원과 팀장이다.

## 실행

```bash
bash e2e/manual/stack/setup.sh              # 격리 스택 기동(최초 1회)
MANUAL_STACK=1 pnpm -C e2e manual           # 두 역할 전 화면 캡처 + 문서 생성
bash e2e/manual/stack/teardown.sh           # 격리 스택 제거(볼륨까지)
```

부분 재캡처:

```bash
MANUAL_STACK=1 MANUAL_ONLY=eval-my pnpm -C e2e manual        # 특정 화면만
MANUAL_STACK=1 MANUAL_ROLE=team_lead pnpm -C e2e manual      # 특정 역할만
```

부분 재캡처를 해도 문서에는 전 화면이 담긴다 — `docs/manual/.capture-report.json`
(캡처 이력)에 이전 결과가 남아 있고 생성 시 병합하기 때문이다. **이 파일을 지우면
다음 부분 실행에서 문서가 그 화면들만 남고 잘린다.**

## 왜 격리 스택인가

캡처하려면 주기 단계를 옮겨야 하는데(아래 표), **주기 단계 전이는 단방향이라
API 로 되돌릴 수 없다**(`closed` 는 종료 상태). 작업 DB 에서 하면 되돌리려고
직접 SQL 을 써야 하고 실수하면 운영 데이터가 어긋난다.

그래서 `e2e/manual/stack/` 이 작업 DB 를 복제해 별도 프로젝트·볼륨·포트(3200/4200)로
띄운다. 이 DB 는 버려질 사본이라 단계를 마음대로 바꾸고, UI 로 데이터를 만들어도 되고,
끝나면 `down -v` 로 통째로 지운다. 작업 스택(3000/4000/5432)은 건드리지 않는다.

복제한 뒤 `anonymize.sql` 이 **DB 값 자체**를 익명화한다(이름·이메일·연봉 +
코멘트·총평 등 자유 텍스트 21개 컬럼). 화면에 그릴 때 가리는 방식은 놓치는 자리가
생기지만, 원본이 없으면 새어나갈 것도 없다.

## 주기 단계별 캡처

화면이 평가 주기 단계와 일정 창에 따라 열리고 닫힌다. 단계를 바꾸며 나눠 찍는다.

| 단계 | 대상 화면 | 이유 |
| --- | --- | --- |
| `mid_review` + 일정 개방 | 대부분 | KPI 작성·검토·중간점검·부서장 평가가 열린 상태 |
| `calibration` | 역량평가, 평가결과, 분포 모니터링, 평가 결과표 | 역량평가와 결과 조회가 이 단계부터 열린다 |
| `closed` | 내 평가표 | 확정 결과 공개가 주기 마감 기준이다 |

```bash
bash e2e/manual/stack/set-state.sh calibration open-window
```

`open-window` 는 `final_review` 일정 창을 오늘이 포함되도록 넓힌다. 본인평가·부서장
평가는 이 창 안에서만 열리고 **구성원·팀장은 면제가 없다**(관리자만 면제).

## 구성

| 파일 | 역할 |
| --- | --- |
| `roles.ts` | 캡처 계정과 문서 머리말. 구성원 `test1@`, 팀장 `test@` |
| `screens.ts` | 화면 카탈로그 — 제목·경로·설명·콜아웃. **매뉴얼 내용은 여기만 고치면 된다** |
| `annotate.ts` | 빨간 박스 + 번호 배지를 캡처 직전 DOM 에 주입 |
| `manual-doc.ts` | 캡처 결과 → 역할별 마크다운 |
| `capture.spec.ts` | 역할별 로그인 → 화면 순회 캡처 |
| `stack/` | 격리 스택(compose·setup·set-state·teardown·anonymize·prepare-roles) |

## 알아둘 것

- **팀장 계정이 `test@energyx.co.kr` 인 이유**: 실제 `team_lead` 계정들은 팀원 KPI 가
  확정 전이라 부서장 평가 화면이 빈 채로 찍힌다. 데이터가 온전한 조직은 테스트팀뿐인데
  그 팀장이 hr_admin 으로 만들어져 있어, 격리 DB 에서 `prepare-roles.sql` 이 role 만
  team_lead 로 낮춘다. 부서장 배정은 role 이 아니라 `Department.headUserId` 기준이라
  (B-1) 평가 체인은 그대로다.
- **인증**: 프론트가 세션 토큰을 `sessionStorage` 에 두므로 `storageState` 로는 심을 수
  없다. 역할별로 API 로그인해 `addInitScript` 로 주입한다.
- **콜아웃 셀렉터**: 앱에 `data-testid` 가 없어 화면의 한글 텍스트와 구조 클래스
  (`gx-work-surface`, `gx-master-detail`)를 앵커로 쓴다. 빗나가면 실행 끝에
  `⚠ 표시 실패 콜아웃` 으로 보고되고 설명 표에도 표시가 남는다.
- **역할마다 화면이 다르다.** 같은 경로라도 구성원에겐 탭이 없거나(중간 점검) 패널이
  없다(역량평가). 콜아웃이 한쪽에서만 매칭되면 화면 항목을 역할별로 나눈다
  (`competency-eval` / `competency-eval-lead` 처럼).
- **모달 화면**은 `setup` 으로 열고 `waitFor: '[role="dialog"]'` 로 확인한다.
  `waitFor` 는 `setup` **뒤에** 평가된다.
