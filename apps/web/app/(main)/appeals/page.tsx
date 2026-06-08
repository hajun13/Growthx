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
import { T } from '@/lib/toss';
import type { Appeal, AppealStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const statusCfg: Record<
  AppealStatus,
  { label: string; bg: string; icon: typeof Clock }
> = {
  submitted: { label: '접수', bg: T.blue500, icon: Clock },
  under_review: { label: '검토중', bg: T.orange500, icon: Clock },
  answered: { label: '답변완료', bg: '#0891b2', icon: CheckCircle2 },
  closed: { label: '처리완료', bg: T.green500, icon: CheckCircle2 },
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
    { label: '전체', value: appeals.length, color: T.blue500 },
    {
      label: '접수/검토중',
      value: appeals.filter(
        (a) => a.status === 'submitted' || a.status === 'under_review',
      ).length,
      color: T.orange500,
    },
    {
      label: '답변완료',
      value: appeals.filter((a) => a.status === 'answered').length,
      color: '#0891b2',
    },
    {
      label: '처리완료',
      value: appeals.filter((a) => a.status === 'closed').length,
      color: T.green500,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="이의제기"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
      />

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 bg-white px-4 py-3"
            style={{ border: `1px solid ${T.grey200}` }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center"
              style={{ background: s.color }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {s.value}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: T.grey700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 신청 폼 (결과에서 진입 시) */}
      {resultId && (
        <div
          className="bg-white p-5"
          style={{ border: `1px solid ${T.grey200}` }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.grey900,
              marginBottom: 12,
            }}
          >
            이의제기 신청
          </h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="이의제기 사유를 작성해 주세요."
            className="w-full resize-none px-3 py-2 outline-none"
            style={{
              fontSize: 13,
              minHeight: 90,
              border: `1px solid ${T.grey200}`,
            }}
          />
          <div className="mt-3 flex justify-end">
            <button
              disabled={!reason.trim() || busy}
              onClick={() => void submitAppeal()}
              className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}
            >
              <Plus size={14} /> 신청하기
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="border px-3 py-1.5 transition-colors"
            style={{
              fontSize: 12,
              fontWeight: 500,
              background: filter === f.key ? T.blue500 : '#fff',
              color: filter === f.key ? '#fff' : T.grey700,
              borderColor: filter === f.key ? T.blue500 : T.grey200,
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
          style={{ border: `1px solid ${T.grey200}`, color: T.grey500, fontSize: 13 }}
        >
          이의제기 내역이 없어요.
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: sel ? '1fr 380px' : '1fr' }}
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
                  className="cursor-pointer bg-white transition-all hover:shadow-md"
                  style={{
                    border: `1px solid ${isSelected ? T.blue500 : T.grey200}`,
                    boxShadow: isSelected ? `0 0 0 2px ${T.blue500}25` : 'none',
                  }}
                >
                  <div className="flex items-start gap-4 p-4">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center"
                      style={{ background: T.grey100 }}
                    >
                      <MessageSquareWarning size={18} color={T.red500} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: T.grey900,
                          }}
                        >
                          {appeal.userName ?? appeal.userId.slice(0, 8)} 님의
                          이의제기
                        </span>
                        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
                          <StatusIcon size={12} color={sc.bg} />
                          <span
                            className="px-2 py-0.5"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: sc.bg,
                              color: '#fff',
                            }}
                          >
                            {sc.label}
                          </span>
                        </div>
                      </div>
                      <p
                        className="line-clamp-2"
                        style={{ fontSize: 12.5, color: T.grey600, lineHeight: 1.5 }}
                      >
                        {appeal.reason}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        {appeal.departmentName && (
                          <span style={{ fontSize: 11.5, color: T.grey500 }}>
                            {appeal.departmentName}
                          </span>
                        )}
                        <span style={{ fontSize: 11.5, color: T.grey500 }}>
                          · {appeal.createdAt.slice(0, 10)}
                        </span>
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
              style={{ border: `1px solid ${T.grey200}`, alignSelf: 'start' }}
            >
              <div
                className="border-b px-5 py-4"
                style={{ background: T.grey50, borderColor: T.grey200 }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                  이의제기 상세
                </h3>
              </div>
              <div className="space-y-4 p-5">
                <DetailRow
                  label="신청자"
                  value={`${sel.userName ?? sel.userId.slice(0, 8)}${
                    sel.departmentName ? ` (${sel.departmentName})` : ''
                  }`}
                />
                <DetailRow label="접수일" value={sel.createdAt.slice(0, 10)} />
                <div>
                  <div
                    style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}
                  >
                    ① 신청 사유
                  </div>
                  <p
                    className="whitespace-pre-wrap"
                    style={{ fontSize: 12.5, color: T.grey900, lineHeight: 1.6 }}
                  >
                    {sel.reason}
                  </p>
                </div>
                {sel.response && (
                  <div>
                    <div
                      style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}
                    >
                      ② 부서장 답변
                    </div>
                    <p
                      className="whitespace-pre-wrap"
                      style={{
                        fontSize: 12.5,
                        color: T.grey900,
                        lineHeight: 1.6,
                      }}
                    >
                      {sel.response}
                    </p>
                  </div>
                )}
                {sel.decision && (
                  <div>
                    <div
                      style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}
                    >
                      ③ HR 최종 결정
                    </div>
                    <p
                      className="whitespace-pre-wrap"
                      style={{
                        fontSize: 12.5,
                        color: T.grey900,
                        lineHeight: 1.6,
                      }}
                    >
                      {sel.decision}
                    </p>
                  </div>
                )}

                {/* 부서장 답변 */}
                {isLeaderOrHr &&
                  (sel.status === 'submitted' ||
                    sel.status === 'under_review') && (
                    <div
                      className="space-y-2 border-t pt-4"
                      style={{ borderColor: T.grey200 }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: T.grey500,
                          marginBottom: 2,
                        }}
                      >
                        부서장 답변 작성
                      </div>
                      <textarea
                        value={responseDraft[sel.id] ?? ''}
                        onChange={(e) =>
                          setResponseDraft((p) => ({
                            ...p,
                            [sel.id]: e.target.value,
                          }))
                        }
                        placeholder="처리 의견을 입력하세요."
                        className="w-full resize-none px-3 py-2 outline-none"
                        style={{
                          fontSize: 12,
                          minHeight: 80,
                          border: `1px solid ${T.grey200}`,
                        }}
                      />
                      <button
                        disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                        onClick={() => void respond(sel.id)}
                        className="w-full py-2 text-white disabled:opacity-50"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: T.blue500,
                        }}
                      >
                        답변 등록
                      </button>
                    </div>
                  )}

                {/* HR 최종 결정 */}
                {isHr && sel.status === 'answered' && (
                  <div
                    className="space-y-2 border-t pt-4"
                    style={{ borderColor: T.grey200 }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: T.grey500,
                        marginBottom: 2,
                      }}
                    >
                      최종 결정 (유지/조정 + 사유)
                    </div>
                    <textarea
                      value={responseDraft[sel.id] ?? ''}
                      onChange={(e) =>
                        setResponseDraft((p) => ({
                          ...p,
                          [sel.id]: e.target.value,
                        }))
                      }
                      placeholder="최종 결정 사유를 입력하세요."
                      className="w-full resize-none px-3 py-2 outline-none"
                      style={{
                        fontSize: 12,
                        minHeight: 80,
                        border: `1px solid ${T.grey200}`,
                      }}
                    />
                    <button
                      disabled={!(responseDraft[sel.id] ?? '').trim() || busy}
                      onClick={() => void decide(sel.id)}
                      className="w-full py-2 text-white disabled:opacity-50"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: T.green500,
                      }}
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
