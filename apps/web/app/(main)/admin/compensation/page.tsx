'use client';

import { useState } from 'react';
import { Lock, Printer, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useTeamCompensationSimulation } from '@/hooks/useCompensations';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { downloadExcel } from '@/lib/excel';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { tierLabel } from '@/lib/ui';
import type { CompensationSimulation, Grade, GroupTier } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

// tier 배지 인라인 색(레퍼런스 톤 — tierStyle className 대신 인라인 스타일 화면이라 매핑).
const tierBadge: Record<GroupTier, { bg: string; fg: string }> = {
  excellent: { bg: '#e7f4ee', fg: '#059669' },
  standard: { bg: '#f2f4f6', fg: '#6b7684' },
  poor: { bg: '#fff8e6', fg: '#b45309' },
};

// 등급(S~D)별 뱃지 색 — 레퍼런스 gradeBg(D 포함, B+ 폐기).
const gradeBg: Record<string, string> = {
  S: '#7C3AED',
  A: '#2272eb',
  B: '#059669',
  C: '#f57800',
  D: '#d22030',
};

// 직급 코드 → 한글 직급 라벨(시스템 폴백). 미정의 코드는 '-' 폴백(아래 사용처).
const positionLabel: Record<string, string> = {
  ceo: '대표이사',
  vice_president: '부대표',
  executive: '상무',
  director: '이사',
  principal: '수석',
  division_head: '본부장',
  team_lead: '팀장',
  chief: '책임',
  senior: '선임',
  pro: '프로',
};

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 원 → 만원 표기(value/10000 → toLocaleString + "만원"). null 은 "—".
function toManwon(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value / 10000).toLocaleString()}만원`;
}

// print HTML 용 만원 표기. null 은 "-".
function toManwonPrint(value: number | null): string {
  if (value == null) return '-';
  return `${Math.round(value / 10000).toLocaleString()}만원`;
}

const GRID =
  '1fr 100px 80px 120px 120px 60px 140px 130px';

export default function CompensationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && isHrAdmin(user.role);

  const [divisionFilter, setDivisionFilter] = useState('전체');
  const [downloading, setDownloading] = useState(false);

  const { data: teamSim } = useTeamCompensationSimulation(
    { cycleId },
    { enabled: allowed && !!cycleId },
  );

  if (!allowed)
    return <Forbidden message="보상 정보는 본인·그룹대표·본부장·관리자만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  const rows: CompensationSimulation[] = teamSim?.data ?? [];

  // 본부 필터 옵션(null 제외 distinct).
  const divisions = [
    '전체',
    ...Array.from(
      new Set(rows.map((r) => r.divisionName).filter((d): d is string => !!d)),
    ),
  ];

  const filtered = rows.filter(
    (r) => divisionFilter === '전체' || r.divisionName === divisionFilter,
  );

  // 등급별 인상률 기준 — 첫 행의 byGrade 에서 등급별 raiseRate 추출.
  const gradeRaise = filtered[0]?.byGrade ?? rows[0]?.byGrade ?? [];

  // 요약 카드 — currentSalary/등급 없는 인원은 합계에서 제외.
  const valid = filtered.filter(
    (r) => r.currentSalary != null && r.currentGrade != null,
  );
  const count = filtered.length;
  const avgRaise =
    valid.length > 0
      ? valid.reduce((s, r) => s + (r.raiseRate ?? 0), 0) / valid.length
      : 0;
  // 총 인건비 증가(원) = Σ(차기-금년). 억원 = /1e8.
  const totalIncreaseWon = valid.reduce((s, r) => {
    if (r.projectedSalary == null || r.currentSalary == null) return s;
    return s + (r.projectedSalary - r.currentSalary);
  }, 0);
  const totalIncreaseEok = Math.round((totalIncreaseWon / 1e8) * 10) / 10;
  const sCount = filtered.filter((r) => r.currentGrade === 'S').length;

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const body = filtered
      .map((r) => {
        const div = r.divisionName ?? '-';
        const team = r.teamName ?? '-';
        const name = r.userName ?? '-';
        const pos = (r.position ? positionLabel[r.position] : null) ?? '-';
        const prev = toManwonPrint(r.previousSalary);
        const cur = toManwonPrint(r.currentSalary);
        const grade = r.currentGrade;
        const gradeCell = grade
          ? `<b style="color:${gradeBg[grade]}">${grade}</b>`
          : '-';
        const next = toManwonPrint(r.projectedSalary);
        let diffCell = '-';
        if (r.projectedSalary != null && r.currentSalary != null) {
          const diffWon = r.projectedSalary - r.currentSalary;
          const diffMan = Math.round(diffWon / 10000);
          const pct =
            r.currentSalary !== 0
              ? ((diffWon / r.currentSalary) * 100).toFixed(1)
              : '0.0';
          const color =
            diffWon > 0 ? '#059669' : diffWon < 0 ? '#d22030' : '#6b7684';
          const sign = diffWon > 0 ? '+' : '';
          diffCell = `<span style="color:${color}">${sign}${diffMan.toLocaleString()}만원 (${sign}${pct}%)</span>`;
        }
        return `<tr>
          <td>${div}</td><td>${team}</td><td>${name}</td><td>${pos}</td>
          <td>${prev}</td><td>${cur}</td>
          <td>${gradeCell}</td>
          <td><b>${next}</b></td>
          <td>${diffCell}</td>
        </tr>`;
      })
      .join('');
    win.document.write(`<!DOCTYPE html><html><head><title>보상 현황</title>
      <style>body{font-family:Pretendard,sans-serif;padding:24px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e8eb;padding:8px 12px}th{background:#f9fafb;font-weight:600}h2{margin-bottom:16px}</style>
      </head><body><h2>에너지엑스 차기년도 보상 현황</h2><table><thead><tr>
        <th>본부</th><th>팀</th><th>이름</th><th>직급</th><th>전년도 연봉</th><th>금년도 연봉</th><th>평가등급</th><th>차기년도 연봉</th><th>인상액(율)</th>
      </tr></thead><tbody>${body}</tbody></table></body></html>`);
    win.document.close();
    win.print();
  };

  async function handleDownload() {
    if (!cycleId) return;
    setDownloading(true);
    try {
      await downloadExcel(
        `/excel/export/compensation?cycleId=${cycleId}`,
        `compensation-${cycleId}.xlsx`,
      );
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '내보내기에 실패했어요.',
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="보상 현황"
        subtitle="평가 결과 기반 차기년도 연봉을 자동으로 산정합니다."
        right={
          <>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 transition-colors"
              style={{
                fontSize: 12.5,
                color: '#4e5968',
                border: '1px solid #e5e8eb',
                background: '#fff',
              }}
            >
              <Printer size={13} /> 출력
            </button>
            <button
              onClick={() => void handleDownload()}
              disabled={!cycleId || downloading}
              className="flex items-center gap-1.5 px-4 py-2 transition-colors disabled:opacity-50"
              style={{ fontSize: 12.5, color: '#fff', background: '#191f28' }}
            >
              <Download size={13} /> {downloading ? '내려받는 중…' : '다운로드'}
            </button>
          </>
        }
      />

      {/* Access notice */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: '#fff8e6', border: '1px solid #ffd666' }}
      >
        <Lock size={13} color="#f57800" />
        <span style={{ fontSize: 12.5, color: '#b45309', fontWeight: 500 }}>
          보상 정보는 <strong>본인 · 그룹대표 · 본부장 · 관리자</strong>만 열람할
          수 있습니다.
        </span>
      </div>

      {/* Grade raise-rate info (RuleSet 실값) */}
      {gradeRaise.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            style={{ fontSize: 11.5, color: '#8b95a1', fontWeight: 500 }}
          >
            등급별 인상률 기준:
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: '#4e5968',
              fontWeight: 500,
              background: '#f2f4f6',
              padding: '1px 6px',
            }}
          >
            그룹실적 보너스 반영
          </span>
          {[...gradeRaise]
            .sort(
              (a, b) =>
                GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade),
            )
            .map((g) => (
              <span key={g.grade} className="flex items-center gap-1">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    background: gradeBg[g.grade],
                    padding: '1px 8px',
                  }}
                >
                  {g.grade}
                </span>
                <span style={{ fontSize: 11.5, color: '#4e5968' }}>
                  {g.raiseRate > 0 ? '+' : ''}
                  {g.raiseRate}%
                </span>
              </span>
            ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 인원', value: `${count}명`, color: '#191f28' },
          {
            label: '평균 인상률',
            value: `${avgRaise.toFixed(1)}%`,
            color: '#059669',
          },
          {
            label: '총 인건비 증가',
            value: `${totalIncreaseEok}억원`,
            color: '#3182f6',
          },
          { label: 'S등급 인원', value: `${sCount}명`, color: '#7C3AED' },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white px-5 py-4"
            style={{ border: '1px solid #e5e8eb' }}
          >
            <div style={{ fontSize: 11.5, color: '#6b7684', marginBottom: 6 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Division filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 12, color: '#6b7684' }}>본부:</span>
        {divisions.map((d) => (
          <button
            key={d}
            onClick={() => setDivisionFilter(d)}
            style={{
              fontSize: 12,
              padding: '4px 12px',
              fontWeight: 500,
              background: divisionFilter === d ? '#191f28' : '#fff',
              color: divisionFilter === d ? '#fff' : '#6b7684',
              border: `1px solid ${
                divisionFilter === d ? '#191f28' : '#e5e8eb'
              }`,
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="bg-white overflow-hidden"
        style={{ border: '1px solid #e5e8eb' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            background: '#f9fafb',
            padding: '10px 20px',
            borderBottom: '1px solid #e5e8eb',
          }}
        >
          {[
            '이름 / 본부 · 팀',
            '직급',
            '평가등급',
            '전년도 연봉',
            '금년도 연봉',
            '',
            '차기년도 연봉',
            '인상액 (율)',
          ].map((h, i) => (
            <div
              key={i}
              style={{ fontSize: 11, fontWeight: 600, color: '#8b95a1' }}
            >
              {h}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ fontSize: 13, color: '#8b95a1' }}
          >
            표시할 보상 데이터가 없어요.
          </div>
        ) : (
          filtered.map((r, i) => {
            const isLast = i === filtered.length - 1;
            const grade = r.currentGrade;
            const sub =
              r.divisionName || r.teamName
                ? [r.divisionName, r.teamName].filter(Boolean).join(' · ')
                : r.departmentName ?? '';
            const hasDiff =
              r.projectedSalary != null && r.currentSalary != null;
            const diffWon = hasDiff
              ? r.projectedSalary! - r.currentSalary!
              : 0;
            const diffMan = Math.round(diffWon / 10000);
            const pct =
              hasDiff && r.currentSalary !== 0
                ? ((diffWon / r.currentSalary!) * 100).toFixed(1)
                : '0.0';
            const diffColor =
              !hasDiff || diffWon === 0
                ? '#8b95a1'
                : diffWon > 0
                  ? '#059669'
                  : '#d22030';
            return (
              <div
                key={r.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  padding: '14px 20px',
                  borderBottom: isLast ? 'none' : '1px solid #f2f4f6',
                  alignItems: 'center',
                }}
                onMouseEnter={(el) =>
                  ((el.currentTarget as HTMLElement).style.background =
                    '#f9fafb')
                }
                onMouseLeave={(el) =>
                  ((el.currentTarget as HTMLElement).style.background =
                    'transparent')
                }
              >
                {/* Name */}
                <div>
                  <div
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 13, fontWeight: 600, color: '#191f28' }}
                  >
                    {r.userName ?? '-'}
                    {r.groupTier && (
                      <span
                        title={`그룹 ${tierLabel[r.groupTier]} · 보너스 ${r.groupTierBonus > 0 ? '+' : ''}${r.groupTierBonus}%p`}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: tierBadge[r.groupTier].bg,
                          color: tierBadge[r.groupTier].fg,
                          padding: '1px 6px',
                        }}
                      >
                        {tierLabel[r.groupTier]}
                        {r.groupTierBonus !== 0
                          ? ` ${r.groupTierBonus > 0 ? '+' : ''}${r.groupTierBonus}%p`
                          : ''}
                      </span>
                    )}
                  </div>
                  {sub && (
                    <div
                      style={{ fontSize: 11, color: '#8b95a1', marginTop: 1 }}
                    >
                      {sub}
                    </div>
                  )}
                </div>
                {/* Position */}
                <div style={{ fontSize: 12.5, color: '#4e5968' }}>
                  {(r.position ? positionLabel[r.position] : null) ?? '-'}
                </div>
                {/* Grade */}
                <div>
                  {grade ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#fff',
                        background: gradeBg[grade],
                        padding: '3px 10px',
                      }}
                    >
                      {grade}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#b0b8c1' }}>—</span>
                  )}
                </div>
                {/* Prev salary */}
                <div style={{ fontSize: 12.5, color: '#6b7684' }}>
                  {toManwon(r.previousSalary)}
                </div>
                {/* Cur salary */}
                <div
                  style={{ fontSize: 12.5, color: '#4e5968', fontWeight: 500 }}
                >
                  {toManwon(r.currentSalary)}
                </div>
                {/* Arrow */}
                <div
                  style={{ fontSize: 16, color: '#b0b8c1', textAlign: 'center' }}
                >
                  →
                </div>
                {/* Next salary */}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#191f28' }}>
                  {toManwon(r.projectedSalary)}
                </div>
                {/* Diff */}
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: diffColor }}
                >
                  {hasDiff ? (
                    <>
                      {diffWon > 0 ? '+' : ''}
                      {diffMan.toLocaleString()}만원
                      <span
                        style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}
                      >
                        ({diffWon > 0 ? '+' : ''}
                        {pct}%)
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
