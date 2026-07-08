'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Info, ChevronRight } from 'lucide-react';
import type {
  Grade,
  StageMode,
  EvaluationByType,
  EvaluationByGroup,
  ByTypeEntry,
} from '@/lib/types';
import { isImportByType } from '@/lib/types';
import { fmtScore, STAGE_LABEL } from '@/lib/ui';
import { useToast } from './Toast';
import { Avatar } from './Avatar';

// 인쇄창은 별도 document라 인라인 팔레트를 쓴다. Part/ 브리프 §2 Solid 등급 색(SSOT).
const GRADE_HEX: Record<Grade, string> = {
  S: '#7C3AED',
  A: '#0EA05E',
  B: '#F97316',
  C: '#F5B400',
  D: '#EF4444',
};
// 글씨는 전 등급 흰색(사용자 확정 2026-07-06).
const GRADE_FG: Record<Grade, string> = {
  S: '#FFFFFF',
  A: '#FFFFFF',
  B: '#FFFFFF',
  C: '#FFFFFF',
  D: '#FFFFFF',
};

const C = {
  ink: '#161326',
  sub: '#2D2A3D',
  mute: '#6B6980',
  faint: '#9B98AC',
  line: '#E7E9F3',
  line2: '#F4F5FA',
  bg: '#F8F9FD',
  bg2: '#F4F5FA',
  blue: '#0257CE',
  blueInk: '#0246A8',
};

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

// 점수(0~100) → 막대 채움 %.
const pct = (s: number | null) => (s === null ? 0 : Math.max(0, Math.min(100, s)));

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

function GradeBox({
  grade,
  size = 50,
  font = 26,
}: {
  grade: Grade | null;
  size?: number;
  font?: number;
}) {
  const bg = grade ? GRADE_HEX[grade] : '#9B98AC';
  const fg = grade ? GRADE_FG[grade] : '#FFFFFF';
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: font,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {grade ?? '–'}
    </div>
  );
}

// 작은 등급 알약(표 셀용).
function GradePill({ grade }: { grade: Grade | null }) {
  if (!grade) return <span style={{ fontSize: 12, color: C.faint }}>–</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        minWidth: 22,
        height: 22,
        padding: '0 7px',
        background: GRADE_HEX[grade],
        color: GRADE_FG[grade],
        fontSize: 12,
        fontWeight: 800,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {grade}
    </span>
  );
}

// 섹션 제목.
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{children}</span>
      {hint && <span style={{ fontSize: 11, color: C.mute }}>{hint}</span>}
    </div>
  );
}

export function EvalReport({ data, onClose }: EvalReportProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

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
      toast.show({
        variant: 'danger',
        message: '팝업이 차단되어 인쇄 창을 열 수 없어요. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해 주세요.',
      });
      return;
    }
    win.document.write(`
      <html><head><title>평가표 - ${data.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; font-size: 13px; color: ${C.ink}; background: #fff; padding: 28px; }
        .no-print { display: none !important; }
        table { border-collapse: collapse; }
        /* 화면 Tailwind 유틸의 인쇄 폴백(인쇄창엔 Tailwind 미적용) */
        .w-full { width: 100%; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        @page { margin: 14mm; }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  // body 포털로 렌더 — 페이지 stacking context에 갇혀 상단바·사이드바가 디밍 위로 떠 보이던 문제 방지.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '32px 16px',
      }}
      onClick={onClose}
    >
      {/* 액션 버튼(인쇄 영역 밖) */}
      <div
        className="no-print"
        style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8, zIndex: 101 }}
      >
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2"
          style={{ fontSize: 13, fontWeight: 600, background: C.ink, color: '#fff' }}
        >
          <Printer size={14} /> 인쇄 · PDF 저장
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 border bg-white px-4 py-2"
          style={{ fontSize: 13, color: C.sub, borderColor: C.line }}
        >
          <X size={14} /> 닫기
        </button>
      </div>

      {/* ── 인쇄 본문(화면과 동일하게 출력) ── */}
      <div
        ref={printRef}
        style={{ width: 880, maxWidth: '100%', background: '#fff' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 4, letterSpacing: '0.4px' }}>
            {data.cycleName ?? '인사평가'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>개인 평가표</div>
        </div>

        {/* 인물 요약 + 등급 박스 */}
        <div
          style={{
            padding: '20px 28px',
            background: C.bg,
            borderBottom: `1px solid ${C.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={data.name} size="lg" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                {data.name}{' '}
                <span style={{ fontSize: 13, fontWeight: 400, color: C.sub }}>{data.title}</span>
              </div>
              <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{data.dept}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: '종합', grade: data.finalGrade, score: data.finalScore, hl: true },
              { label: '성과중심', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null },
              { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null },
            ].map((g) => (
              <div
                key={g.label}
                style={{
                  textAlign: 'center',
                  border: `1px solid ${g.hl ? C.blue : C.line}`,
                  padding: '12px 18px',
                  background: '#fff',
                  minWidth: 92,
                }}
              >
                <div style={{ fontSize: 11, color: g.hl ? C.blueInk : C.mute, marginBottom: 6, fontWeight: g.hl ? 700 : 400 }}>
                  {g.label}
                </div>
                <div style={{ margin: '0 auto 4px', width: 42 }}>
                  <GradeBox grade={g.grade} size={42} font={22} />
                </div>
                <div style={{ fontSize: 11, color: C.sub }}>({fmtScore(g.score)})</div>
              </div>
            ))}
            {/* 역량 평가 — 참고용 (등급·연봉 미반영) */}
            <div
              style={{
                textAlign: 'center',
                border: `1px dashed ${C.faint}`,
                padding: '12px 18px',
                background: C.bg,
                minWidth: 92,
              }}
            >
              <div style={{ fontSize: 10, color: C.mute, background: C.bg2, padding: '1px 6px', display: 'inline-block', marginBottom: 4 }}>
                참고용
              </div>
              <div style={{ fontSize: 11, color: C.mute, marginBottom: 6 }}>역량 평가</div>
              <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: bt?.compScore != null ? C.ink : C.faint }}>
                  {bt?.compScore != null ? fmtScore(bt.compScore) : '–'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.mute }}>미반영</div>
            </div>
          </div>
        </div>

        {/* 산정 기준 안내 */}
        <div
          style={{
            padding: '10px 28px',
            background: '#eaf1fe',
            borderBottom: `1px solid ${C.line}`,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 11.5,
            color: C.blueInk,
          }}
        >
          <Info size={13} />
          최종 등급은 <strong>실적(KPI) 100% 기준</strong>이며, <strong>역량평가는 등급에 반영되지 않는 참고용</strong>이에요.
          {data.percentile !== null && (
            <span style={{ marginLeft: 'auto', color: C.sub }}>
              전사 상위 <strong style={{ color: C.ink }}>{data.percentile}%</strong>
              {avg !== null && <> · 전사 평균 <strong style={{ color: C.ink }}>{fmtScore(avg)}</strong></>}
            </span>
          )}
        </div>

        {isImport ? (
          <ImportBody bt={bt} />
        ) : (
          <LiveBody bt={bt} finalGrade={data.finalGrade} bg={bg} />
        )}

        {/* 푸터 */}
        <div
          style={{
            borderTop: `1px solid ${C.line}`,
            padding: '14px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: C.bg,
          }}
        >
          <span style={{ fontSize: 11, color: C.mute }}>
            에너지엑스 인사 평가 · 출력일 {new Date().toLocaleDateString('ko-KR')}
          </span>
          <span style={{ fontSize: 11, color: C.faint }}>본 문서는 기밀이며 지정된 열람 권한자 외 공유 금지</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── 라이브 결과 본문(다단계 · 역량 참고 · 예외) ──
function LiveBody({
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
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.line}` }}>
        <SectionTitle hint="상위 직책자가 하위 전원을 평가 · 본인평가는 참고용(등급 미반영)">
          다단계 평가 (실적)
        </SectionTitle>

        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: C.bg2, color: C.sub }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>단계</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>평가자</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, width: 220 }}>실적 점수</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, width: 64 }}>등급</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const score = s.entry?.score ?? null;
              const grade = s.entry?.grade ?? null;
              return (
                <tr key={s.label} style={{ borderBottom: `1px solid ${C.line2}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: C.ink }}>
                    {s.label}
                    {s.ref && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: C.mute,
                          background: C.bg2,
                          padding: '1px 6px',
                        }}
                      >
                        참고
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: C.sub }}>{s.who}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <ScoreBar score={score} dim={s.ref} grade={s.ref ? null : grade} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {s.ref ? <span style={{ fontSize: 11, color: C.faint }}>–</span> : <GradePill grade={grade} />}
                  </td>
                </tr>
              );
            })}
            {/* 합산 실적 */}
            <tr style={{ background: '#eaf1fe', borderTop: `2px solid ${C.blue}` }}>
              <td style={{ padding: '12px', fontWeight: 800, color: C.blueInk }} colSpan={2}>
                합산 실적 (최종 등급 기준)
              </td>
              <td style={{ padding: '12px', textAlign: 'right' }}>
                <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>
                  {fmtScore(perfSum)}
                </span>
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <GradePill grade={finalGrade} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 적용 방식 배지 */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: C.bg,
            border: `1px solid ${C.line}`,
            fontSize: 11.5,
            color: badge.tone === 'ex' ? C.ink : C.sub,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              background: badge.tone === 'ex' ? C.ink : C.mute,
              padding: '2px 7px',
            }}
          >
            합산 방식
          </span>
          {badge.text}
        </div>
      </div>

      {/* KPI 그룹별 */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.line}` }}>
        <SectionTitle hint="KPI 100% = 성과중심 80% + 협업·성장 20%">KPI 그룹별 점수</SectionTitle>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {/* 막대·마커 색 = 해당 그룹의 실제 등급 색(등급 미집계 시 중립 회색). */}
          <GroupCard
            label="성과중심"
            weight="80%"
            color={bg?.performance_core.grade ? GRADE_HEX[bg.performance_core.grade] : C.faint}
            score={bg?.performance_core.score ?? null}
            grade={bg?.performance_core.grade ?? null}
          />
          <GroupCard
            label="협업·성장"
            weight="20%"
            color={bg?.collaboration_growth.grade ? GRADE_HEX[bg.collaboration_growth.grade] : C.faint}
            score={bg?.collaboration_growth.score ?? null}
            grade={bg?.collaboration_growth.grade ?? null}
          />
        </div>
      </div>

      {/* 역량평가 (참고용) */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.line}` }}>
        <SectionTitle hint="연 1회 · 등급/연봉 미반영">역량평가 (참고용)</SectionTitle>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 16px',
            border: `1px dashed ${C.faint}`,
            background: C.bg,
          }}
        >
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
            역량 점수는 조직 역량 추이를 보기 위한 <strong>참고 자료</strong>예요.{' '}
            <span style={{ color: C.mute }}>최종 등급·연봉에는 반영되지 않습니다.</span>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: compScore !== null ? C.ink : C.faint }}>
              {compScore !== null ? fmtScore(compScore) : '미실시'}
            </div>
            <div style={{ fontSize: 10.5, color: C.mute, marginTop: 2 }}>역량 환산점수</div>
          </div>
        </div>
      </div>

      {/* 평가 코멘트(단계별) */}
      <div style={{ padding: '20px 28px 24px' }}>
        <SectionTitle>평가 코멘트</SectionTitle>
        {commentRows.length === 0 ? (
          <p style={{ fontSize: 12.5, color: C.mute }}>아직 등록된 코멘트가 없어요.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {commentRows.map((c) => (
              <div
                key={c.label}
                style={{
                  border: `1px solid ${c.strong ? C.blue : C.line}`,
                  borderLeft: `3px solid ${c.strong ? C.blue : C.faint}`,
                  padding: '12px 16px',
                  background: c.strong ? '#eaf1fe' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: c.strong ? C.blueInk : C.sub }}>
                    {c.label}
                  </span>
                  {c.strong && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: C.blue, padding: '1px 6px' }}>
                      최종
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.ink, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// 가로 점수 막대(표 셀) — 등급이 있으면 해당 등급 색으로 채운다(참고 행은 회색 유지).
function ScoreBar({ score, dim, grade }: { score: number | null; dim?: boolean; grade?: Grade | null }) {
  if (score === null) {
    return <span style={{ fontSize: 11.5, color: C.faint }}>미집계</span>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ position: 'relative', flex: 1, height: 6, background: C.bg2, maxWidth: 150 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: 6,
            width: `${pct(score)}%`,
            background: dim ? C.faint : grade ? GRADE_HEX[grade] : C.blue,
          }}
        />
      </div>
      <span className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: dim ? C.sub : C.ink, minWidth: 40, textAlign: 'right' }}>
        {fmtScore(score)}
      </span>
    </div>
  );
}

// KPI 그룹 카드.
function GroupCard({
  label,
  weight,
  color,
  score,
  grade,
}: {
  label: string;
  weight: string;
  color: string;
  score: number | null;
  grade: Grade | null;
}) {
  return (
    <div style={{ flex: 1, minWidth: 200, border: `1px solid ${C.line}`, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, background: color }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{label}</span>
          <span style={{ fontSize: 10.5, color: C.mute, background: C.bg2, padding: '1px 6px' }}>{weight}</span>
        </div>
        <GradePill grade={grade} />
      </div>
      <div style={{ position: 'relative', height: 8, background: C.bg2 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: `${pct(score)}%`, background: color }} />
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>
          {fmtScore(score)}
        </span>
        <span style={{ fontSize: 11, color: C.mute }}> / 100</span>
      </div>
    </div>
  );
}

// ── 임포트(과거) 결과 본문 — 1차/2차/최종 × 실적·역량(참고) ──
function ImportBody({ bt }: { bt: EvaluationByType | null }) {
  const rows = [
    { label: '1차', r: bt?.round1 },
    { label: '2차', r: bt?.round2 },
    { label: '최종', r: bt?.final },
  ];
  return (
    <>
      <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.line}` }}>
        <SectionTitle hint="과거(임포트) 결과 · 라운드별 실적/역량 요약">라운드별 요약</SectionTitle>
        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: C.bg2, color: C.sub }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>라운드</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>실적</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>역량 (참고)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderBottom: `1px solid ${C.line2}` }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: C.ink }}>{row.label}</td>
                <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: C.ink }}>
                  {row.r?.perf != null ? fmtScore(row.r.perf) : '–'}
                </td>
                <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: C.mute }}>
                  {row.r?.comp != null ? fmtScore(row.r.comp) : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '16px 28px 24px' }}>
        <div
          style={{
            background: C.bg,
            border: `1px dashed ${C.faint}`,
            padding: '12px 16px',
            fontSize: 11.5,
            color: C.sub,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <ChevronRight size={13} color={C.mute} />
          과거(임포트) 결과는 평가자별 코멘트 대신 라운드별 실적·역량 요약으로 표시돼요. 역량 점수는 참고용이에요.
        </div>
      </div>
    </>
  );
}
