// EvalReport — 라이브 결과 본문(다단계 · 역량 참고 · 예외).
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Grade, StageMode, EvaluationByType, EvaluationByGroup, ByTypeEntry } from '@/lib/types';
import { fmtScore, STAGE_LABEL } from '@/lib/ui';
import { GradePill, GroupCard, ScoreBar, SectionTitle } from './EvalReportParts';

// 예외 적용 방식 → 설명 배지(텍스트/색).
function stageModeBadge(mode: StageMode | undefined): { text: string; tone: 'normal' | 'ex' } {
  switch (mode) {
    case 'exception1':
      return { text: '예외 ① 1차 평가자 = 최종평가자 → 1차 100% 반영', tone: 'ex' };
    case 'exception2':
      return { text: '예외 ② 2차 평가자 = 최종평가자 → 1차 70% + 최종 30% 반영', tone: 'ex' };
    default:
      return { text: '정상 가중 · 1차 50% + 2차 30% + 최종 20%', tone: 'normal' };
  }
}

export function LiveBody({
  bt,
  finalGrade,
  bg,
}: {
  bt: EvaluationByType | null;
  finalGrade: Grade | null;
  bg: EvaluationByGroup | null;
}) {
  const perfSum = bt?.perfSum ?? null;
  const compScore = bt?.compScore ?? null;
  const badge = stageModeBadge(bt?.stageMode);

  // 1·2차 평가자는 피평가자에 따라 다르다(직원=팀장·본부장 / 팀장=본부장·부그룹장 /
  // 본부장=부그룹장) — 역할 고정 표기 대신 '상급 부서장'. 최종은 항상 그룹대표.
  // 단계 라벨은 lib/ui STAGE_LABEL 단일 소스(화면별 표기 분열 방지).
  const stages: { label: string; who: string; entry: ByTypeEntry | undefined; ref?: boolean }[] = [
    { label: STAGE_LABEL.self, who: '본인', entry: bt?.self, ref: true },
    { label: STAGE_LABEL.d1, who: '상급 부서장', entry: bt?.downward1 },
    { label: STAGE_LABEL.d2, who: '상급 부서장', entry: bt?.downward2 },
    { label: STAGE_LABEL.d3, who: '그룹대표', entry: bt?.downward3 },
  ];

  // 코멘트가 있는 단계만(최종 강조).
  const commentRows = [
    { label: STAGE_LABEL.d3, text: bt?.downward3?.comment ?? null, strong: true },
    { label: STAGE_LABEL.d2, text: bt?.downward2?.comment ?? null },
    { label: STAGE_LABEL.d1, text: bt?.downward1?.comment ?? null },
    { label: STAGE_LABEL.self, text: bt?.self?.comment ?? null },
  ].filter((c) => !!c.text);

  return (
    <>
      {/* 다단계 실적 평가 표 */}
      <div className="border-b border-border px-7 py-5">
        <SectionTitle hint="상위 직책자가 하위 전원을 평가 · 본인평가는 참고용(등급 미반영)">
          다단계 평가 (실적)
        </SectionTitle>

        <Table>
          <TableHeader>
            <TableRow plain>
              <TableHead>단계</TableHead>
              <TableHead>평가자</TableHead>
              <TableHead textAlign="right" className="w-55">
                실적 점수
              </TableHead>
              <TableHead textAlign="center" className="w-16">
                등급
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((s) => {
              const score = s.entry?.score ?? null;
              const grade = s.entry?.grade ?? null;
              return (
                <TableRow key={s.label} plain>
                  <TableCell className="text-12h font-semibold text-foreground">
                    {s.label}
                    {s.ref && (
                      <Badge variant="muted" size="xs" className="ml-1.5">
                        참고
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-12h text-neutral-800">{s.who}</TableCell>
                  <TableCell>
                    <ScoreBar score={score} dim={s.ref} grade={s.ref ? null : grade} />
                  </TableCell>
                  <TableCell textAlign="center">
                    {s.ref ? <span className="text-11 text-neutral-500">–</span> : <GradePill grade={grade} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {/* 합산 실적 */}
          <TableFooter>
            <TableRow plain>
              <TableCell colSpan={2} className="text-12h font-extrabold text-brand-blue-hover">
                합산 실적 (최종 등급 기준)
              </TableCell>
              <TableCell textAlign="right" className="text-16 font-extrabold text-foreground tabular-nums">
                {fmtScore(perfSum)}
              </TableCell>
              <TableCell textAlign="center">
                <GradePill grade={finalGrade} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {/* 적용 방식 배지 */}
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-md border border-border bg-neutral-50 px-3 py-2 text-11h',
            badge.tone === 'ex' ? 'text-foreground' : 'text-neutral-800',
          )}
        >
          <span
            className={cn(
              'rounded-sm px-1.75 py-0.5 text-10 font-bold text-neutral-0',
              badge.tone === 'ex' ? 'bg-neutral-950' : 'bg-neutral-600',
            )}
          >
            합산 방식
          </span>
          {badge.text}
        </div>
      </div>

      {/* KPI 그룹별 */}
      <div className="border-b border-border px-7 py-5">
        <SectionTitle hint="KPI 100% = 성과중심 80% + 협업·성장 20%">KPI 그룹별 점수</SectionTitle>
        <div className="flex flex-wrap gap-3.5">
          <GroupCard
            label="성과중심"
            weight="80%"
            score={bg?.performance_core.score ?? null}
            grade={bg?.performance_core.grade ?? null}
          />
          <GroupCard
            label="협업·성장"
            weight="20%"
            score={bg?.collaboration_growth.score ?? null}
            grade={bg?.collaboration_growth.grade ?? null}
          />
        </div>
      </div>

      {/* 역량평가 (참고용) */}
      <div className="border-b border-border px-7 py-5">
        <SectionTitle hint="연 1회 · 등급/연봉 미반영">역량평가 (참고용)</SectionTitle>
        <div className="flex items-center justify-between gap-4 rounded-md border border-dashed border-neutral-500 bg-neutral-50 px-4 py-3.5">
          <div className="text-12 leading-normal text-neutral-800">
            역량 점수는 조직 역량 추이를 보기 위한 <strong>참고 자료</strong>예요.{' '}
            <span className="text-muted-foreground">최종 등급·연봉에는 반영되지 않습니다.</span>
          </div>
          <div className="shrink-0 text-center">
            <div
              className={cn(
                'text-22 font-extrabold tabular-nums',
                compScore !== null ? 'text-foreground' : 'text-neutral-500',
              )}
            >
              {compScore !== null ? fmtScore(compScore) : '미실시'}
            </div>
            <div className="mt-0.5 text-10h text-muted-foreground">역량 환산점수</div>
          </div>
        </div>
      </div>

      {/* 평가 코멘트(단계별) */}
      <div className="px-7 pt-5 pb-6">
        <SectionTitle>평가 코멘트</SectionTitle>
        {commentRows.length === 0 ? (
          <p className="text-12h text-muted-foreground">아직 등록된 코멘트가 없어요.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {commentRows.map((c) => (
              <div
                key={c.label}
                className={cn(
                  'rounded-md border border-l-3 px-4 py-3',
                  c.strong ? 'border-primary bg-info-50' : 'border-border border-l-neutral-500 bg-card',
                )}
              >
                <div className="mb-1.25 flex items-center gap-1.5">
                  <span className={cn('text-11h font-bold', c.strong ? 'text-brand-blue-hover' : 'text-neutral-800')}>
                    {c.label}
                  </span>
                  {c.strong && (
                    <span className="rounded-sm bg-primary px-1.5 py-px text-10 font-bold text-primary-foreground">
                      최종
                    </span>
                  )}
                </div>
                <div className="text-13 leading-relaxed whitespace-pre-wrap text-foreground">{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
