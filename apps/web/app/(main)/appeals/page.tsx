'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAppeals, appealCommands } from '@/hooks/useAppeals';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { cx, appealStatusStyle } from '@/lib/ui';
import type { Appeal } from '@/lib/types';

function AppealBadge({ status }: { status: Appeal['status'] }) {
  const s = appealStatusStyle[status];
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-[2px] text-xs font-medium',
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

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
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>(
    {},
  );

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="이의제기"
        subtitle="등급 통보 후 7일 이내에 신청할 수 있어요."
      />

      <InfoBanner tone="warning" title="이의제기 안내">
        평가 결과에 이의가 있으면 사유를 작성해 신청하세요. HR 검토 후 답변을
        드려요. 신청 기한(통보 후 7일)을 확인하세요.
      </InfoBanner>

      {/* 신청(결과에서 진입 시) */}
      {resultId && (
        <Card title="이의제기 신청">
          <div className="flex flex-col gap-3">
            <TextField
              label="사유 (필수)"
              multiline
              rows={3}
              value={reason}
              onChange={setReason}
              placeholder="이의제기 사유를 작성해 주세요."
              required
            />
            <div className="flex justify-end">
              <Button
                disabled={!reason.trim() || busy}
                loading={busy}
                onClick={() => void submitAppeal()}
              >
                신청하기
              </Button>
            </div>
          </div>
        </Card>
      )}

      {appeals.length === 0 ? (
        <EmptyState title="이의제기 내역이 없어요." />
      ) : (
        <ul className="flex flex-col gap-4">
          {appeals.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-foreground">
                      {a.userName ?? a.userId.slice(0, 8)} 님의 이의제기
                    </span>
                    <AppealBadge status={a.status} />
                  </div>
                  <Field label="① 신청 사유" value={a.reason} />
                  {a.response && (
                    <Field label="② 1차 답변(팀장)" value={a.response} />
                  )}
                  {a.decision && (
                    <Field label="③ HR 최종 결정" value={a.decision} />
                  )}

                  {/* 팀장 1차 답변 */}
                  {isLeaderOrHr &&
                    (a.status === 'submitted' ||
                      a.status === 'under_review') && (
                      <div className="flex flex-col gap-2 border-t border-border pt-3">
                        <TextField
                          label="1차 답변"
                          multiline
                          rows={2}
                          value={responseDraft[a.id] ?? ''}
                          onChange={(v) =>
                            setResponseDraft((p) => ({ ...p, [a.id]: v }))
                          }
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            disabled={!(responseDraft[a.id] ?? '').trim() || busy}
                            onClick={() => void respond(a.id)}
                          >
                            답변 등록
                          </Button>
                        </div>
                      </div>
                    )}

                  {/* HR 최종 결정 */}
                  {isHr && a.status === 'answered' && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <TextField
                        label="최종 결정 (유지/조정 + 사유)"
                        multiline
                        rows={2}
                        value={responseDraft[a.id] ?? ''}
                        onChange={(v) =>
                          setResponseDraft((p) => ({ ...p, [a.id]: v }))
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={!(responseDraft[a.id] ?? '').trim() || busy}
                          onClick={() => void decide(a.id)}
                        >
                          최종 결정
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <p className="whitespace-pre-wrap text-base text-foreground">{value}</p>
    </div>
  );
}
