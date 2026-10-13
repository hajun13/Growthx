'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X, Printer, Info } from 'lucide-react';
import type { Grade, EvaluationByType, EvaluationByGroup } from '@/lib/types';
import { isImportByType } from '@/lib/types';
import { fmtScore } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GradeBox } from './EvalReportParts';
import { LiveBody } from './EvalReportLive';
import { ImportBody } from './EvalReportImport';

export interface EvalReportData {
  name: string;
  dept: string;
  title: string;
  finalGrade: Grade | null;
  finalScore: number | null;
  percentile: number | null;
  companyAvg: number | null;
  byType: EvaluationByType | null;
  byGroup: EvaluationByGroup | null;
  cycleName?: string;
}

export interface EvalReportProps {
  data: EvalReportData;
  onClose: () => void;
}

// 이름 해시 → 파스텔 폴백 톤(공용 Avatar 래퍼와 동일 규칙).
const AVATAR_TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;
function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

// 인쇄창은 별도 document 라 화면의 스타일시트를 그대로 복제해 넣는다(본문이 L1/토큰 클래스).
function printStyles(): string {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => (el instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${el.href}">` : el.outerHTML))
    .join('');
}

export function EvalReport({ data, onClose }: EvalReportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const bt = data.byType;
  const bg = data.byGroup;
  const avg = data.companyAvg;
  const isImport = isImportByType(bt);

  // Esc 로 모달 닫기 — 배경 클릭 외 키보드 이탈 경로 제공.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      // 팝업 차단 시 무반응이던 문제 — 원인과 해결 방법을 안내한다.
      toast.error('팝업이 차단되어 인쇄 창을 열 수 없어요. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해 주세요.', {
        duration: 8000,
      });
      return;
    }
    win.document.write(`
      <html><head><title>평가표 - ${data.name}</title>
      ${printStyles()}
      <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-size: 13px; color: var(--color-neutral-950); background: #fff; padding: 28px; }
        .no-print { display: none !important; }
        @page { margin: 14mm; }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    // 스타일시트 로드를 기다린 뒤 인쇄(로드 이벤트가 없으면 2초 후 폴백).
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      win.print();
      win.close();
    };
    win.addEventListener('load', () => setTimeout(go, 200));
    setTimeout(go, 2000);
  };

  const summary = [
    { label: '종합', grade: data.finalGrade, score: data.finalScore, hl: true },
    { label: '성과중심', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null, hl: false },
    { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null, hl: false },
  ];

  // body 포털로 렌더 — 페이지 stacking context에 갇혀 상단바·사이드바가 디밍 위로 떠 보이던 문제 방지.
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      {/* 액션 버튼(인쇄 영역 밖) */}
      <div className="fixed top-5 right-5 z-101 flex gap-2">
        <Button size="sm" onClick={handlePrint}>
          <Printer size={14} /> 인쇄 · PDF 저장
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          <X size={14} /> 닫기
        </Button>
      </div>

      {/* ── 인쇄 본문(화면과 동일하게 출력) ── */}
      <div
        ref={printRef}
        className="w-220 max-w-full overflow-hidden rounded-lg bg-card text-13 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="border-b border-border px-7 pt-6 pb-4.5">
          <div className="mb-1 text-11 tracking-wide text-muted-foreground">{data.cycleName ?? '인사평가'}</div>
          <div className="text-20 font-extrabold text-foreground">개인 평가표</div>
        </div>

        {/* 인물 요약 + 등급 박스 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-neutral-50 px-7 py-5">
          <div className="flex items-center gap-3.5">
            <Avatar size="lg">
              <AvatarFallback role="img" aria-label={data.name} size="lg" tone={avatarTone(data.name || '?')}>
                {data.name.trim().charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-16 font-bold text-foreground">
                {data.name} <span className="text-13 font-normal text-neutral-800">{data.title}</span>
              </div>
              <div className="mt-0.5 text-12 text-muted-foreground">{data.dept}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {summary.map((g) => (
              <div
                key={g.label}
                className={cn(
                  'min-w-23 rounded-md border bg-card px-4.5 py-3 text-center',
                  g.hl ? 'border-primary' : 'border-border',
                )}
              >
                <div
                  className={cn(
                    'mb-1.5 text-11',
                    g.hl ? 'font-bold text-brand-blue-hover' : 'text-muted-foreground',
                  )}
                >
                  {g.label}
                </div>
                <div className="mx-auto mb-1 w-10.5">
                  <GradeBox grade={g.grade} />
                </div>
                <div className="text-11 text-neutral-800">({fmtScore(g.score)})</div>
              </div>
            ))}
            {/* 역량 평가 — 참고용 (등급·연봉 미반영) */}
            <div className="min-w-23 rounded-md border border-dashed border-neutral-500 bg-neutral-50 px-4.5 py-3 text-center">
              <Badge variant="muted" size="xs" className="mb-1">
                참고용
              </Badge>
              <div className="mb-1.5 text-11 text-muted-foreground">역량 평가</div>
              <div className="mx-auto mb-1 flex h-10.5 items-center justify-center">
                <span
                  className={cn(
                    'text-20 font-extrabold',
                    bt?.compScore != null ? 'text-foreground' : 'text-neutral-500',
                  )}
                >
                  {bt?.compScore != null ? fmtScore(bt.compScore) : '–'}
                </span>
              </div>
              <div className="text-11 text-muted-foreground">미반영</div>
            </div>
          </div>
        </div>

        {/* 산정 기준 안내 */}
        <div className="flex items-center gap-1.75 border-b border-border bg-info-50 px-7 py-2.5 text-11h text-brand-blue-hover">
          <Info size={13} />
          최종 등급은 <strong>실적(KPI) 100% 기준</strong>이며, <strong>역량평가는 등급에 반영되지 않는 참고용</strong>이에요.
          {data.percentile !== null && (
            <span className="ml-auto text-neutral-800">
              전사 상위 <strong className="text-foreground">{data.percentile}%</strong>
              {avg !== null && (
                <>
                  {' '}
                  · 전사 평균 <strong className="text-foreground">{fmtScore(avg)}</strong>
                </>
              )}
            </span>
          )}
        </div>

        {isImport ? <ImportBody bt={bt} /> : <LiveBody bt={bt} finalGrade={data.finalGrade} bg={bg} />}

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-border bg-neutral-50 px-7 py-3.5">
          <span className="text-11 text-muted-foreground">
            에너지엑스 KPI 시스템 · 출력일 {new Date().toLocaleDateString('ko-KR')}
          </span>
          <span className="text-11 text-neutral-500">본 문서는 기밀이며 지정된 열람 권한자 외 공유 금지</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
