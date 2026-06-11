'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquareWarning,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppeals, appealCommands } from '@/hooks/useAppeals';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Skeleton, ErrorState } from '@/components/States';
import type { Appeal, AppealStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

// ── Kinetic Enterprise 팔레트 ───────────────────────────────────
const K = {
  primary: '#3f2c80',
  primaryContainer: '#564599',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#cac4d2',
  outlineDim: 'rgba(202,196,210,0.4)',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const statusCfg: Record<
  AppealStatus,
  { label: string; bg: string; icon: typeof Clock }
> = {
  submitted: { label: '접수', bg: K.secondary, icon: Clock },
  under_review: { label: '검토중', bg: '#f57800', icon: Clock },
  answered: { label: '답변완료', bg: K.tertiary, icon: CheckCircle2 },
  closed: { label: '처리완료', bg: K.primary, icon: CheckCircle2 },
};

const FILTERS: { key: 'all' | AppealStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'submitted', label: '접수' },
  { key: 'under_review', label: '검토중' },
  { key: 'answered', label: '답변완료' },
  { key: 'closed', label: '처리완료' },
];

export default function AppealsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AppealsInner />
    </Suspense>
  );
}

function AppealsInner() {
  const { user } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const resultId = searchParams.get('resultId');

  const { data, loading, error, reload } = useAppeals({}, { enabled: !!user });
  const appeals: Appeal[] = data?.data ?? [];

  const isLeaderOrHr =
    !!user &&
    (user.role === 'team_lead' ||
      user.role === 'division_head' ||
      user.role === 'hr_admin');
  const isHr = user?.role === 'hr_admin';

  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AppealStatus>('all');
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>(
    {},
  );

  const filtered = useMemo(
    () => appeals.filter((a) => filter === 'all' || a.status === filter),
    [appeals, filter],
  );
  const sel = appeals.find((a) => a.id === selected) ?? null;

  async function submitAppeal() {
    if (!resultId || !reason.trim()) return;
    setBusy(true);
    try {
      await appealCommands.create({ resultId, reason: reason.trim() });
      toast.show({ variant: 'success', message: '이의제기를 신청했어요.' });
      setReason('');
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'APPEAL_WINDOW_CLOSED'
          ? '신청 기간(7일)이 지났어요.'
          : err instanceof ApiError
            ? err.message
            : '신청에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string) {
    const text = (responseDraft[id] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await appealCommands.respond(id, text);
      toast.show({ variant: 'success', message: '답변을 등록했어요.' });
      setResponseDraft((p) => ({ ...p, [id]: '' }));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '답변에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string) {
    const text = (responseDraft[id] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await appealCommands.decide(id, text);
      toast.show({ variant: 'success', message: '최종 결정을 등록했어요.' });
      setResponseDraft((p) => ({ ...p, [id]: '' }));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '결정에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState onRetry={reload} />;

  const stats = [
    { label: '전체', value: appeals.length, color: K.primary },
    {
      label: '접수/검토중',
      value: appeals.filter(
        (a) => a.status === 'submitted' || a.status === 'under_review',
      ).length,
      color: '#f57800',
    },
    {
      label: '답변완료',
      value: appeals.filter((a) => a.status === 'answered').length,
      color: K.tertiary,
    },
    {
      label: '처리완료',
      value: appeals.filter((a) => a.status === 'closed').length,
      color: K.secondary,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="이의제기"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
      />

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 bg-white px-5 py-4"
            style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, boxShadow: CARD_SHADOW }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: 10, background: s.color + '15' }}
            >
              <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </span>
            </div>
            <div style={{ fontSize: 13, color: K.onSurfaceVariant, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 신청 폼 (결과에서 진입 시) */}
      {resultId && (
        <div
          className="bg-white p-5"
          style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, boxShadow: CARD_SHADOW }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface, marginBottom: 12 }}>
            이의제기 신청
          </h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="이의제기 사유를 작성해 주세요."
            className="w-full resize-none outline-none"
            style={{
              fontSize: 13,
              minHeight: 90,
              border: `1px solid ${K.outline}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: K.onSurface,
              background: K.surfaceLow,
              transition: 'border-color .12s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,84,202,0.10)`; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = K.outline; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <div className="mt-3 flex justify-end">
            <button
              disabled={!reason.trim() || busy}
              onClick={() => void submitAppeal()}
              className="flex items-center gap-1.5 px-5 py-2 text-white disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600, background: K.secondary, borderRadius: 8 }}
            >
              <Plus size={14} /> 신청하기
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="transition-all"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: filter === f.key ? K.primary : K.white,
              color: filter === f.key ? '#fff' : K.onSurfaceVariant,
              border: `1px solid ${filter === f.key ? K.primary : K.outline}`,
              borderRadius: 999,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 목록 + 상세 */}
      {filtered.length === 0 ? (
        <div
          className="bg-white py-16 text-center"
          style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, color: K.onSurfaceVariant, fontSize: 13, boxShadow: CARD_SHADOW }}
        >
          이의제기 내역이 없어요.
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: sel ? '1fr 400px' : '1fr' }}
        >
          <div className="space-y-3">
            {filtered.map((appeal) => {
              const sc = statusCfg[appeal.status];
              const StatusIcon = sc.icon;
              const isSelected = selected === appeal.id;
              return (
                <div
                  key={appeal.id}
                  onClick={() => setSelected(isSelected ? null : appeal.id)}
                  className="cursor-pointer bg-white transition-all"
                  style={{
                    border: `1px solid ${isSelected ? K.primary : K.outlineDim}`,
                    borderRadius: 12,
                    boxShadow: isSelected ? `0 0 0 2px rgba(63,44,128,0.15), ${CARD_SHADOW}` : CARD_SHADOW,
                    borderLeft: isSelected ? `3px solid ${K.primary}` : `3px solid transparent`,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.25)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = K.outlineDim; }}
                >
                  <div className="flex items-start gap-4 p-4">
                    <div
                      className="flex-shrink-0 flex h-10 w-10 items-center justify-center"
                      style={{ background: 'rgba(186,26,26,0.08)', borderRadius: 8 }}
                    >
                      <MessageSquareWarning size={18} color='#ba1a1a' />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: K.onSurface }}>
                          {appeal.userName ?? appeal.userId.slice(0, 8)} 님의 이의제기
                        </span>
                        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                          <StatusIcon size={12} color={sc.bg} />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: sc.bg,
                              color: '#fff',
                              padding: '2px 10px',
                              borderRadius: 999,
                            }}
                          >
                            {sc.label}
                          </span>
                        </div>
                      </div>
                      <p className="line-clamp-2" style={{ fontSize: 12.5, color: K.onSurfaceVariant, lineHeight: 1.5 }}>
                        {appeal.reason}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        {appeal.departmentName && (
                          <span style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>{appeal.departmentName}</span>
                        )}
                        <span style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>· {appeal.createdAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 상세 패널 */}
          {sel && (
            <div
              className="overflow-hidden bg-white"
              style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, alignSelf: 'start', boxShadow: CARD_SHADOW }}
            >
              <div
                className="px-5 py-4 border-b"
                style={{ background: K.surfaceLow, borderColor: K.outlineDim }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface }}>이의제기 상세</h3>
              </div>
              <div className="space-y-4 p-5">
                <DetailRow label="신청자" value={`${sel.userName ?? sel.userId.slice(0, 8)}${sel.departmentName ? ` (${sel.departmentName})` : ''}`} />
                <DetailRow label="접수일" value={sel.createdAt.slice(0, 10)} />
                <div>
                  <div style={{ fontSize: 11, color: K.onSurfaceVariant, marginBottom: 4, fontWeight: 600 }}>① 신청 사유</div>
                  <p className="whitespace-pre-wrap" style={{ fontSize: 12.5, color: K.onSurface, lineHeight: 1.6 }}>
                    {sel.reason}
                  </p>
                </div>
                {sel.response && (
                  <div>
                    <div style={{ fontSize: 11, color: K.onSurfaceVariant, marginBottom: 4, fontWeight: 600 }}>② 부서장 답변</div>
                    <p className="whitespace-pre-wrap" style={{ fontSize: 12.5, color: K.onSurface, lineHeight: 1.6 }}>
                      {sel.response}
                    </p>
                  </div>
                )}
                {sel.decision && (
                  <div>
                    <div style={{ fontSize: 11, color: K.onSurfaceVariant, marginBottom: 4, fontWeight: 600 }}>③ HR 최종 결정</div>
                    <p className="whitespace-pre-wrap" style={{ fontSize: 12.5, color: K.onSurface, lineHeight: 1.6 }}>
                      {sel.decision}
                    </p>
                  </div>
                )}

                {/* 부서장 답변 */}
                {isLeaderOrHr && (sel.status === 'submitted' || sel.status === 'under_review') && (
                  <div className="space-y-2 border-t pt-4" style={{ borderColor: K.outlineDim }}>
                    <div style={{ fontSize: 11, color: K.onSurfaceVariant, marginBottom: 2, fontWeight: 600 }}>
                      부서장 답변 작성
                    </div>
                    <textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="처리 의견을 입력하세요."
                      className="w-full resize-none outline-none"
                      style={{
                        fontSize: 12,
                        minHeight: 80,
                        border: `1px solid ${K.outline}`,
                        borderRadius: 8,
                        padding: '9px 11px',
                        color: K.onSurface,
                        background: K.surfaceLow,
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = K.outline; }}
                    />
                    <button
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      onClick={() => void respond(sel.id)}
                      className="w-full py-2 text-white disabled:opacity-50"
                      style={{ fontSize: 12.5, fontWeight: 600, background: K.secondary, borderRadius: 8 }}
                    >
                      답변 등록
                    </button>
                  </div>
                )}

                {/* HR 최종 결정 */}
                {isHr && sel.status === 'answered' && (
                  <div className="space-y-2 border-t pt-4" style={{ borderColor: K.outlineDim }}>
                    <div style={{ fontSize: 11, color: K.onSurfaceVariant, marginBottom: 2, fontWeight: 600 }}>
                      최종 결정 (유지/조정 + 사유)
                    </div>
                    <textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) => setResponseDraft((p) => ({ ...p, [sel.id]: e.target.value }))}
                      placeholder="최종 결정 사유를 입력하세요."
                      className="w-full resize-none outline-none"
                      style={{
                        fontSize: 12,
                        minHeight: 80,
                        border: `1px solid ${K.outline}`,
                        borderRadius: 8,
                        padding: '9px 11px',
                        color: K.onSurface,
                        background: K.surfaceLow,
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = K.tertiary; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = K.outline; }}
                    />
                    <button
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      onClick={() => void decide(sel.id)}
                      className="w-full py-2 text-white disabled:opacity-50"
                      style={{ fontSize: 12.5, fontWeight: 600, background: K.tertiary, borderRadius: 8 }}
                    >
                      최종 결정
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b95a1', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: '#191f28' }}>{value}</div>
    </div>
  );
}
