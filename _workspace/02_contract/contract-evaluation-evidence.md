# API 계약 — 본인평가 문항별 증빙 첨부 (EvaluationEvidence)

추가일: 2026-06-08. 본인평가(및 일반 평가) 화면에서 **KPI 문항별로 증빙 파일**을 첨부·조회·삭제.

## 데이터 모델

`EvaluationEvidence` — `(evaluationId, kpiId)` 단위. 파일 바이트는 DB `Bytes` 컬럼에 저장(자체호스팅 Docker, postgres 볼륨으로 영속).
> KpiScore 는 `patch` 시마다 `deleteMany` 후 재생성되므로 **kpiScoreId 가 아니라 kpiId 에 직접** 묶는다(저장해도 첨부 유지).

| 필드 | 타입 | 비고 |
|------|------|------|
| id | string(uuid) | |
| evaluationId | string | FK → evaluations, onDelete Cascade |
| kpiId | string | FK → kpis, onDelete Cascade |
| filename | string | 원본 파일명(≤255) |
| mimeType | string | |
| size | int | bytes |
| uploadedById | string | 업로더 user id(관계 미선언, 스칼라) |
| createdAt | datetime | |

응답에는 `data`(bytes) 제외, 메타데이터만 반환.

## 엔드포인트 (`/api/v1` 프리픽스, camelCase, `{data}`/`{data,meta}` 봉투)

| 메서드·경로 | 권한 | 설명 |
|------------|------|------|
| `GET /evaluations/:id/evidence?kpiId=` | 평가 조회 권한자(평가자 본인 또는 피평가자 가시 상위) | 첨부 메타데이터 목록. `{data, meta}` |
| `POST /evaluations/:id/evidence?kpiId=` | 평가자 본인(or hr_admin), 작성 가능 상태 | multipart, field=`file`. `{data}`(메타) |
| `GET /evaluations/:id/evidence/:evidenceId/download` | 조회 권한자 | 바이너리 스트림. `Content-Disposition: inline; filename*=UTF-8''…` |
| `DELETE /evaluations/:id/evidence/:evidenceId` | 평가자 본인, 작성 가능 상태 | `{data:{id, deleted}}` |

### 규칙·검증
- **작성 가능 상태**: `submitted`/`finalized` 이후 업로드·삭제 차단(403 FORBIDDEN). 평가 본문 잠금과 동일.
- **kpiId 검증**: 해당 평가의 피평가자·주기 소속 KPI 가 아니면 404 NOT_FOUND.
- **파일 크기**: 10MB 초과 시 413 `FILE_TOO_LARGE`(서비스 검증). multer 한도 20MB 는 메모리 백스톱.
- **MIME 허용목록**: 문서(pdf·office·hwp·txt·csv)·이미지(png·jpeg·gif·webp)·zip. 그 외 422 `UNSUPPORTED_FILE_TYPE`.
- **다운로드**: Bearer 토큰 인증이라 단순 `<a href>` 불가 → 프론트는 인증 헤더로 Blob fetch 후 `URL.createObjectURL`로 새 탭 오픈(`openEvidence`).

## 프론트 연동
- 훅: `useEvaluationEvidence(evaluationId)`, `evidenceCommands.upload/remove`, `openEvidence()` (`apps/web/hooks/useEvaluations.ts`).
- api 헬퍼: `apiUpload`(FormData), `apiDownloadBlob` (`apps/web/lib/api.ts`).
- 화면:
  - 본인평가 `eval/self` 각 KPI 카드 하단 `EvidenceSection`(목록·미리보기·삭제·업로드). 제출 후엔 보기만.
  - 부서장평가 `eval/dept-head` 각 KPI 카드에 피평가자가 첨부한 증빙을 **읽기전용**으로 노출(미리보기·다운로드, 업로드/삭제 없음). 증빙은 self 평가에 귀속되므로 `useEvaluationEvidence(selfEval.id)`로 조회(백엔드가 검토자 조회 허용).
- **인라인 미리보기** `components/EvidencePreview.tsx`(공용): PDF→`<iframe>`, 이미지→`<img>`, 그 외→다운로드 안내. `isEvidencePreviewable(mime)`로 분기. 양식 고정 불필요 — 파일 형식(MIME)으로만 판정.

---

# 부서장 평가 문항별 코멘트 (KpiScore.reviewerNote)

추가일: 2026-06-08. 부서장 평가에서 **KPI 문항별 코멘트** 작성.

- 저장: `KpiScore.reviewerNote String?` (각 평가의 KpiScore 에 귀속 — self 의 `selfNote` 와 별개). `patch` 의 `kpiScores[].reviewerNote` 로 전달(빈 값은 미전송→null).
- **종합 코멘트는 선택**: downward(팀장/본부장) 제출 게이트가 `Comment ≥1` **또는** `reviewerNote 있는 KpiScore ≥1` 이면 통과(둘 다 없으면 422 `COMMENT_REQUIRED`). 프론트도 동일하게 종합 OR 문항별 중 하나면 제출 허용.
- 프론트: `eval/dept-head` KpiEvalCard 에 문항별 코멘트 textarea + 종합 코멘트는 (선택). `KpiScore`/`KpiScoreInput`/`PatchEvaluationRequest` 타입에 `reviewerNote` 추가.
