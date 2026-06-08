'use client';

import { useRef } from 'react';
import { X, Printer, ChevronRight, Lock } from 'lucide-react';
import type { Grade, EvaluationByType, EvaluationByGroup } from '@/lib/types';
import { isImportByType } from '@/lib/types';
import { fmtScore } from '@/lib/ui';

// 등급 색(tailwind grade 토큰과 동일 hex — 인쇄창은 별도 document라 인라인 사용).
const GRADE_HEX: Record<Grade, string> = {
  S: '#1B4DCB',
  A: '#3182F6',
  B: '#15B66E',
  C: '#F5A623',
  D: '#F04452',
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

const ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 점수(0~100) → 막대 채움 %.
const pct = (s: number | null) => (s === null ? 0 : Math.max(0, Math.min(100, s)));

function GradeBox({
  grade,
  size = 50,
  font = 26,
}: {
  grade: Grade | null;
  size?: number;
  font?: number;
}) {
  const bg = grade ? GRADE_HEX[grade] : '#b0b8c1';
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        color: '#fff',
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

// 평가자 단계 가로 막대 1행.
function HorizBar({
  label,
  score,
  grade,
  avg,
  color,
}: {
  label: string;
  score: number | null;
  grade: Grade | null;
  avg: number | null;
  color: string;
}) {
  if (score === null) {
    return (
      <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
        <div style={{ width: 96, fontSize: 11.5, color: '#6b7684', textAlign: 'right', flexShrink: 0 }}>
          {label}
        </div>
        <div style={{ flex: 1, height: 22, display: 'flex', alignItems: 'center' }}>
          <div style={{ height: 8, background: '#f2f4f6', width: '100%' }} />
          <span style={{ marginLeft: 8, fontSize: 11, color: '#b0b8c1', whiteSpace: 'nowrap' }}>
            미집계 (–)
          </span>
        </div>
      </div>
    );
  }
  const fill = pct(score);
  const avgPct = pct(avg);
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
      <div style={{ width: 96, fontSize: 11.5, color: '#6b7684', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, position: 'relative', height: 22 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 8, background: '#f2f4f6', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, width: `${fill}%`, height: 8, background: color, transform: 'translateY(-50%)' }} />
        {avg !== null && (
          <div style={{ position: 'absolute', top: 0, left: `${avgPct}%`, height: '100%', width: 2, background: '#191f28', opacity: 0.3 }} title={`전사 평균 ${fmtScore(avg)}`} />
        )}
        <div style={{ position: 'absolute', top: '50%', left: `${fill}%`, transform: 'translate(6px, -50%)', fontSize: 11, fontWeight: 700, color: grade ? GRADE_HEX[grade] : '#4e5968', whiteSpace: 'nowrap' }}>
          {grade ?? '–'} ({fmtScore(score)})
        </div>
      </div>
    </div>
  );
}

export function EvalReport({ data, onClose }: EvalReportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const bt = data.byType;
  const bg = data.byGroup;
  const avg = data.companyAvg;
  const isImport = isImportByType(bt);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>평가표 - ${data.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; font-size: 13px; color: #191f28; background: #fff; padding: 32px; }
        .no-print { display: none !important; }
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

  // 단일 캐스케이드: 부서장 평가는 직속 1명만(1차/2차 구분 폐기). 데이터 키 downward1/2 중 채워진 쪽을 단일 행으로.
  const downwardEntry = isImport ? null : bt?.downward1 ?? bt?.downward2 ?? null;

  // 종합평가 단계별 행.
  //  - live  : 본인 → 부서장 평가 (평가자별 score/grade, 단일)
  //  - import : 1차 → 2차 → 최종 (실적 perf 점수, 등급 정보 없음 — 과거 데이터 라운드 유지)
  const overallRows = isImport
    ? [
        { label: '1차 (실적)', score: bt?.round1?.perf ?? null, grade: null as Grade | null },
        { label: '2차 (실적)', score: bt?.round2?.perf ?? null, grade: null as Grade | null },
        { label: '최종 (실적)', score: bt?.final?.perf ?? null, grade: null as Grade | null },
      ]
    : [
        { label: '본인평가', score: bt?.self?.score ?? null, grade: bt?.self?.grade ?? null },
        { label: '부서장 평가', score: downwardEntry?.score ?? null, grade: downwardEntry?.grade ?? null },
      ];

  const evaluators = isImport
    ? [
        { name: '1차', role: '실적 평가', color: '#3182f6' },
        { name: '2차', role: '실적 평가', color: '#333d4b' },
        { name: '최종', role: '실적 평가', color: '#191f28' },
      ]
    : [
        { name: data.name, role: '본인평가', color: '#3182f6' },
        { name: '부서장', role: '부서장 평가', color: '#191f28' },
      ];

  // 코멘트는 live shape 에만 존재. 단일 캐스케이드 — 직속 부서장 코멘트 1건.
  const downwardComment = isImport ? null : downwardEntry?.comment ?? null;

  return (
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
      {/* 버튼 */}
      <div className="no-print" style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8, zIndex: 101 }}>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-white"
          style={{ fontSize: 13, fontWeight: 600, background: '#191f28' }}
        >
          <Printer size={14} /> 인쇄
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 border border-border bg-white px-4 py-2"
          style={{ fontSize: 13, color: '#4e5968' }}
        >
          <X size={14} /> 닫기
        </button>
      </div>

      {/* 리포트 본문 */}
      <div
        ref={printRef}
        style={{ width: 860, maxWidth: '100%', background: '#fff' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 열람 제한 안내 */}
        <div className="no-print" style={{ background: '#191f28', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={13} color="#fe9800" />
          <span style={{ fontSize: 12, color: '#b0b8c1' }}>
            이 평가표는 <strong style={{ color: '#fff' }}>본인 · 그룹대표 · 본부장 · 관리자</strong>만 열람할 수 있습니다.
          </span>
        </div>

        {/* 헤더 */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e5e8eb' }}>
          <div style={{ fontSize: 11, color: '#8b95a1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {data.cycleName ?? '인사평가'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#191f28' }}>평가 상세결과</div>
        </div>

        {/* 인물 요약 */}
        <div style={{ padding: '20px 28px', background: '#f9fafb', borderBottom: '1px solid #e5e8eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3182f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {data.name.slice(0, 1)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#191f28' }}>
                {data.name} <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7684' }}>{data.title}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8b95a1', marginTop: 2 }}>{data.dept}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: '종합', grade: data.finalGrade, score: data.finalScore },
              { label: '성과중심', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null },
              { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null },
            ].map((g) => (
              <div key={g.label} style={{ textAlign: 'center', border: '1px solid #e5e8eb', padding: '12px 20px', background: '#fff' }}>
                <div style={{ fontSize: 11, color: '#8b95a1', marginBottom: 6 }}>{g.label}</div>
                <div style={{ margin: '0 auto 4px', width: 42 }}>
                  <GradeBox grade={g.grade} size={42} font={22} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7684' }}>({fmtScore(g.score)})</div>
              </div>
            ))}
          </div>
        </div>

        {/* 평가 단계별 평가자 */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e8eb' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#191f28', marginBottom: 14 }}>평가 단계별 평가자</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
            {evaluators.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 auto 6px' }}>
                    {e.name.slice(0, 1)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#191f28' }}>{e.name}</div>
                  <div style={{ fontSize: 10.5, color: '#8b95a1', marginTop: 2 }}>{e.role}</div>
                </div>
                {i < evaluators.length - 1 && (
                  <ChevronRight size={16} color="#b0b8c1" style={{ margin: '0 12px', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 평가 섹션 */}
        <div style={{ padding: '20px 28px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: '종합평가', color: '#3182f6' },
              { label: '성과중심', color: '#15B66E' },
              { label: '협업·성장', color: '#9333EA' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f2f4f6' }}>
                <div style={{ width: 8, height: 8, background: s.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4e5968' }}>{s.label}</span>
              </div>
            ))}
            {avg !== null && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 2, background: '#191f28', opacity: 0.3 }} />
                <span style={{ fontSize: 11, color: '#8b95a1' }}>전사 평균</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 종합평가: 단계별 비교 */}
            <ReportSection
              label="종합평가"
              grade={data.finalGrade}
              score={data.finalScore}
              percentile={data.percentile}
              barColor="#3182f6"
              avg={avg}
              rows={overallRows}
            />
            {/* 성과중심 */}
            <ReportSection
              label="성과중심 (KPI)"
              grade={bg?.performance_core.grade ?? null}
              score={bg?.performance_core.score ?? null}
              barColor="#15B66E"
              avg={avg}
              rows={[
                { label: '성과중심', score: bg?.performance_core.score ?? null, grade: bg?.performance_core.grade ?? null },
              ]}
            />
            {/* 협업·성장 */}
            <ReportSection
              label="협업·성장"
              grade={bg?.collaboration_growth.grade ?? null}
              score={bg?.collaboration_growth.score ?? null}
              barColor="#9333EA"
              avg={avg}
              rows={[
                { label: '협업·성장', score: bg?.collaboration_growth.score ?? null, grade: bg?.collaboration_growth.grade ?? null },
              ]}
            />
          </div>
        </div>

        {/* 코멘트 (live shape 에만 존재) — 단일 부서장 평가 */}
        {downwardComment && (
          <div style={{ padding: '0 28px 24px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#191f28', marginBottom: 12, borderTop: '1px solid #e5e8eb', paddingTop: 20 }}>
              평가 코멘트
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ border: '1px solid #e5e8eb', padding: '12px 16px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7684', marginBottom: 4 }}>부서장</div>
                <div style={{ fontSize: 13, color: '#191f28', whiteSpace: 'pre-wrap' }}>{downwardComment}</div>
              </div>
            </div>
          </div>
        )}

        {/* 임포트 결과 안내 */}
        {isImport && (
          <div style={{ padding: '0 28px 24px' }}>
            <div style={{ background: '#f9fafb', border: '1px dashed #c6d3e3', padding: '12px 16px', fontSize: 11.5, color: '#6b7684' }}>
              과거(임포트) 결과는 평가자별 코멘트 대신 라운드별 실적·역량 요약으로 표시돼요. 역량 점수는 참고용이에요.
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div style={{ borderTop: '1px solid #e5e8eb', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
          <span style={{ fontSize: 11, color: '#8b95a1' }}>에너지엑스 인사 평가 · 출력일: {new Date().toLocaleDateString('ko-KR')}</span>
          <span style={{ fontSize: 11, color: '#b0b8c1' }}>본 문서는 기밀이며 지정된 열람 권한자 외 공유 금지</span>
        </div>
      </div>
    </div>
  );
}

function ReportSection({
  label,
  grade,
  score,
  percentile,
  barColor,
  avg,
  rows,
}: {
  label: string;
  grade: Grade | null;
  score: number | null;
  percentile?: number | null;
  barColor: string;
  avg: number | null;
  rows: { label: string; score: number | null; grade: Grade | null }[];
}) {
  return (
    <div style={{ border: '1px solid #e5e8eb', display: 'flex', flexWrap: 'wrap' }}>
      {/* 왼쪽 요약 */}
      <div style={{ width: 140, flexShrink: 0, padding: '20px 16px', borderRight: '1px solid #e5e8eb', textAlign: 'center', background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginBottom: 10 }}>{label}</div>
        <GradeBox grade={grade} size={50} font={26} />
        <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginTop: 6 }}>({fmtScore(score)})</div>
        {percentile !== null && percentile !== undefined && (
          <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 6, background: '#f2f4f6', padding: '2px 8px' }}>
            상위 {percentile}%
          </div>
        )}
      </div>
      {/* 오른쪽 막대 */}
      <div style={{ flex: 1, minWidth: 240, padding: '20px 24px 16px' }}>
        {rows.map((row) => (
          <HorizBar key={row.label} label={row.label} score={row.score} grade={row.grade} avg={avg} color={barColor} />
        ))}
        {avg !== null && (
          <div style={{ fontSize: 10.5, color: '#8b95a1', textAlign: 'right', marginTop: 4 }}>
            전사 평균 {fmtScore(avg)}
          </div>
        )}
      </div>
    </div>
  );
}
