'use client';

// KPI 임포트 화면의 표시 조각 — 섹션 카드, 상태 배지, 진행 단계, 적재 결과 카드.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DesignLabel } from '@/components/DesignLabel';
import type { FileEntry, RowStatus } from './importModel';

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">{title}</CardTitle>
          {action}
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">{children}</CardContent>
    </Card>
  );
}

// ── 상태 배지 (로컬 전용 상태 표현 — DS StatusBadge와 별개 도메인) ──
export function ImportStatusBadge({ status, needsReview }: { status: RowStatus; needsReview?: boolean }) {
  // 미리보기에 검토 필요(무효 행·파싱 경고)가 남은 파일 — 전체 적재에서 자동 커밋되지 않는다.
  if (status === 'previewed' && needsReview) {
    return (
      <DesignLabel tone="amber" className="gap-1" title="무효 행 또는 파싱 경고가 있어요. 내용을 검토한 뒤 파일별 [적재]로 진행해 주세요.">
        <AlertTriangle size={12} aria-hidden />
        검토 필요
      </DesignLabel>
    );
  }
  const map: Record<RowStatus, { label: string; tone: React.ComponentProps<typeof DesignLabel>['tone']; Icon?: React.ElementType }> = {
    idle:       { label: '대기', tone: 'gray' },
    previewing: { label: '미리보기 중', tone: 'blue', Icon: Loader2 },
    previewed:  { label: '확인됨', tone: 'gray', Icon: CheckCircle2 },
    importing:  { label: '적재 중', tone: 'blue', Icon: Loader2 },
    imported:   { label: '적재 완료', tone: 'green', Icon: CheckCircle2 },
    submitting: { label: '제출 중', tone: 'blue', Icon: Loader2 },
    submitted:  { label: '제출 완료', tone: 'green', Icon: CheckCircle2 },
    error:      { label: '오류', tone: 'red', Icon: AlertTriangle },
  };
  const s = map[status];
  const spin = status === 'previewing' || status === 'importing' || status === 'submitting';
  return (
    <DesignLabel tone={s.tone} className="gap-1">
      {s.Icon && <s.Icon size={12} className={spin ? 'animate-spin' : undefined} aria-hidden />}
      {s.label}
    </DesignLabel>
  );
}

const IMPORT_STEPS = [
  { label: '파일 업로드', desc: '.xlsx 드래그&드롭' },
  { label: '대상자 매칭', desc: '파일별 사원 선택' },
  { label: '미리보기 · 검토', desc: '내용 확인 후 편집' },
  { label: '적재 완료', desc: 'draft KPI 생성' },
];

/** 임포트 단계 진행 표시. step=현재 단계(0~3), processing=실제 처리 중(스피너). */
export function ImportStepper({ step, processing }: { step: number; processing: boolean }) {
  return (
    <SectionCard title="임포트 진행 단계">
      <div className="flex items-center gap-0">
        {IMPORT_STEPS.map((s, idx) => {
          const done = step > idx;
          const active = step === idx;
          return (
            <div key={idx} className="flex items-center flex-1">
              <div className="flex min-w-20 shrink-0 flex-col items-center gap-1.5">
                {/* 스피너는 실제 처리 중에만 — 사용자 대기(active) 단계는 정적 아이콘 */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${done ? 'bg-info-50' : active ? 'bg-primary/5' : 'bg-muted'}`}>
                  {done
                    ? <CheckCircle2 size={20} className="text-info-700" />
                    : active && processing
                      ? <Loader2 size={20} className="text-primary animate-spin" />
                      : active
                        ? <Circle size={20} className="text-primary" />
                        : <Circle size={20} className="text-muted-foreground" />
                  }
                </div>
                <span className={`text-xs text-center ${done ? 'font-bold text-info-700' : active ? 'font-bold text-primary' : 'font-medium text-muted-foreground'}`}>
                  {s.label}
                </span>
                <span className="text-10h text-muted-foreground text-center">{s.desc}</span>
              </div>
              {idx < IMPORT_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-9 ${done ? 'bg-info-500' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── 적재 결과 카드 ──
export function ResultCard({ entry }: { entry: FileEntry }) {
  const r = entry.result;
  if (!r) return null;
  return (
    <div className={`mt-3 border rounded-md px-4 py-3 ${r.ok ? 'border-success-500/40 bg-success-50' : 'border-warning-500/40 bg-warning-50'}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`text-12h font-bold ${r.ok ? 'text-success-700' : 'text-warning-700'}`}>
          {r.imported}개 지표를 {entry.status === 'submitted' ? '적재·제출했어요 (submitted)' : '적재했어요 (draft)'}
        </span>
        {r.deletedDrafts > 0 && <span className="text-11h text-muted-foreground">기존 draft {r.deletedDrafts}개 교체</span>}
        <span className="text-11h text-muted-foreground tabular-nums">가중치 합 {r.weightSum}%</span>
        <Link href="/kpi/review" className="ml-auto inline-flex items-center gap-1 text-11h font-semibold text-primary hover:underline">
          KPI 검토로 이동 <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
      {r.warnings.length > 0 && (
        <ul className="mt-1.5 pl-4 list-disc">
          {r.warnings.map((w, i) => (<li key={i} className="text-11h text-warning-700">{w}</li>))}
        </ul>
      )}
      {r.errors.length > 0 && (
        <ul className="mt-1.5 pl-4 list-disc">
          {r.errors.map((e, i) => (<li key={`${e.row}-${i}`} className="text-11h text-danger-700">{e.row}행: {e.message}</li>))}
        </ul>
      )}
    </div>
  );
}
