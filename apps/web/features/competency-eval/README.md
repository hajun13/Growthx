# competency-eval feature

역량평가서 화면 슬라이스 — **엑셀 역량평가서 양식 재현**. 라우트 `/(main)/competency/eval` 가 `<CompetencyEvalView/>` 만 렌더한다.

역량평가는 **참고용**(연봉·등급 미반영) — 연 1회(12월 최종평가 단계) 진행. **본인평가 + 1차/2차/최종 평가자**가
같은 시트에 열 단위로 응답한다(다단계 하향 평가와 동일 평가선). 평가점수 환산 = 평가자별
Σ(점수×문항가중치)/만점×100 → 1차 50%·2차 30%·최종 20% 합산(+평가자 동일인 예외①②), 본인평가 미반영.

## 구성

| 파일 | 책임 |
|------|------|
| `api.ts` | `@growthx/contracts` 생성 클라이언트 호출 + 봉투 unwrap. 시트/대상/응답 조회, 일괄 저장·제출, 종합의견 저장. |
| `hooks.ts` | `useCompetencySheet`·`useCompetencyTargets`(+레거시 questions/responses 훅) + `competencyResponseCommands`. |
| `ui/CompetencyEvalView.tsx` | 컨테이너 — **master-detail**(좌: 본인+구성원 대상 목록 `EvaluationSubjectPanel`, 검색·상태필터 / 우: 평가서). [평가가이드] 표시, 제출 후 다음 미제출 대상 자동 이동. |
| `ui/SheetTable.tsx` | 엑셀 본문 표 — 지표(rowSpan)·가중치·행동지표·본인/1차/2차/최종 4열. 내 열만 편집(1~5 버튼, 보기 라벨 title). 문항별 의견·합계 행 없음(종합의견으로 일원화). |
| `ui/OpinionSection.tsx` | [종합의견](단계별, 내 단계만 편집) + 평가점수 환산(우측 rowSpan) + 각주(평가비율·예외). |
| `ui/useCompetencyForm.ts` | 내 열 점수·근거 + 종합의견 드래프트, dirty 추적, 저장/제출(평가자 열은 `targetUserId` 전송). |
| `ui/SubmitPanel.tsx` | 하단 sticky 진행률 + 임시저장/최종제출. |

## 데이터 흐름·규칙

- 메인 조회는 `GET /competency-sheet?cycleId&userId` 한 번 — 문항(피평가자 대상군 기준)+전 단계 응답+종합의견+
  평가선(chain)+환산(conversion)+`myStage`/`canEdit`/`scoresVisible` 를 함께 받는다.
- **본인 조기열람 게이트**: 피평가자 본인에게 평가자 열·종합의견·환산은 주기 `closed` 후 공개(`scoresVisible`).
- 평가자 저장은 `POST /competency-responses/bulk` + `targetUserId`(단계는 백엔드가 하향 평가 배정에서 판정),
  종합의견은 `PUT /competency-opinions`(빈 값=삭제).
- 평가 대상 목록은 `GET /competency-targets?cycleId` — 하향 평가 배정(Evaluation)과 동일 평가선.
- 점수 버튼은 1~5, 백엔드 저장은 Grade enum(S/A/B/C/D) — `useCompetencyForm` 의 매핑 사용.

> 문항 CRUD 는 관리자 화면(`/admin/competency/items`) 소관 — 본 슬라이스는 조회·응답만 사용.
