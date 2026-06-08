'use client';

import { useId } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Card } from './Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InfoBanner } from './InfoBanner';
import { cn } from '@/lib/utils';
import { schedulePhaseText } from '@/lib/ui';

// 편집 중 단계 1건. notifyOffsets 는 D-7/D-3/D-1 체크 → [7,3,1] 부분집합.
export interface PhaseDraft {
  phase: string;
  startDate?: string; // YYYY-MM-DD (M3 Item 5 — 시작일)
  dueDate: string; // YYYY-MM-DD
  notifyOffsets: number[];
  notifyEnabled: boolean;
  isLocked?: boolean; // M3 Item 5 — 잠금 토글
}

export interface ScheduleEditorProps {
  phases: PhaseDraft[];
  onPhaseChange: (phase: string, patch: Partial<PhaseDraft>) => void;
  channels: { inApp: boolean; email: boolean };
  onChannelsChange: (c: { inApp: boolean; email: boolean }) => void;
  // Cycle Ops §2: 잠금 토글을 단건 즉시 호출로 분리. nextLocked=false(열기)는 사유 모달.
  onToggleLock: (phase: string, nextLocked: boolean) => void;
  // 처리 중인 phase(중복 클릭 방지·로딩 표시).
  lockBusyPhase?: string | null;
}

const OFFSETS = [7, 3, 1] as const;

function toggleOffset(list: number[], off: number): number[] {
  return list.includes(off)
    ? list.filter((o) => o !== off)
    : [...list, off].sort((a, b) => b - a);
}

export function ScheduleEditor({
  phases,
  onPhaseChange,
  channels,
  onChannelsChange,
  onToggleLock,
  lockBusyPhase,
}: ScheduleEditorProps) {
  const inAppId = useId();
  const emailId = useId();

  // 마감일 단조성(이전 단계 마감 ≤ 다음 단계 마감) 검증.
  const orderWarning = phases.some((p, i) => {
    if (i === 0) return false;
    const prev = phases[i - 1].dueDate;
    return prev && p.dueDate && prev > p.dueDate;
  });

  return (
    <div className="flex flex-col gap-6">
      <Card title="단계별 마감일·알림">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">단계</th>
                <th className="py-2 pr-3 font-medium">마감일</th>
                <th className="py-2 pr-3 font-medium">알림 사용</th>
                <th className="py-2 font-medium">리드타임 (D-7/D-3/D-1)</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.phase} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {schedulePhaseText(p.phase)}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="date"
                      aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                      value={p.dueDate}
                      onChange={(e) =>
                        onPhaseChange(p.phase, { dueDate: e.target.value })
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Checkbox
                      aria-label={`${schedulePhaseText(p.phase)} 알림 사용`}
                      checked={p.notifyEnabled}
                      onCheckedChange={(c) =>
                        onPhaseChange(p.phase, { notifyEnabled: c === true })
                      }
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex gap-3">
                      {OFFSETS.map((off) => (
                        <label
                          key={off}
                          className="flex items-center gap-1.5 text-sm"
                        >
                          <Checkbox
                            aria-label={`${schedulePhaseText(p.phase)} D-${off}`}
                            checked={p.notifyOffsets.includes(off)}
                            disabled={!p.notifyEnabled}
                            onCheckedChange={() =>
                              onPhaseChange(p.phase, {
                                notifyOffsets: toggleOffset(
                                  p.notifyOffsets,
                                  off,
                                ),
                              })
                            }
                          />
                          D-{off}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orderWarning && (
          <p className="mt-2 text-sm text-warning-700">
            앞 단계 마감일이 뒤 단계보다 늦어요. 단계 순서를 확인해 주세요.
          </p>
        )}
      </Card>

      {/* M3 Item 5: 평가 기간 관리 — 시작/마감 + 잠금 토글 */}
      <Card title="평가 기간 관리 (잠금/열기)">
        <p className="mb-4 text-sm text-muted-foreground">
          각 단계의 시작일·마감일을 정하고, 잠그면 해당 기간의 KPI 작성·수정이
          차단돼요. 잠금/열기는 즉시 적용되며, 다시 열 때(재오픈)는 사유를 입력해야
          해요. 임직원 화면 상단에 현재 기간과 마감일이 안내돼요.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">단계</th>
                <th className="py-2 pr-3 font-medium">시작일</th>
                <th className="py-2 pr-3 font-medium">마감일</th>
                <th className="py-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => {
                const locked = p.isLocked ?? false;
                const busy = lockBusyPhase === p.phase;
                return (
                  <tr key={`lock-${p.phase}`} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium text-foreground">
                      {schedulePhaseText(p.phase)}
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 시작일`}
                        value={p.startDate ?? ''}
                        onChange={(e) =>
                          onPhaseChange(p.phase, { startDate: e.target.value })
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                        value={p.dueDate}
                        onChange={(e) =>
                          onPhaseChange(p.phase, { dueDate: e.target.value })
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-pressed={locked}
                        disabled={busy}
                        aria-label={`${schedulePhaseText(p.phase)} ${locked ? '잠김 — 열기' : '열림 — 잠그기'}`}
                        onClick={() => onToggleLock(p.phase, !locked)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                          locked
                            ? 'border-warning-200 bg-warning-50 text-warning-700'
                            : 'border-success-200 bg-success-50 text-success-700',
                        )}
                      >
                        {locked ? (
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <LockOpen className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {busy ? '처리 중…' : locked ? '잠김' : '열림'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="알림 채널">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={inAppId}
              checked={channels.inApp}
              onCheckedChange={(c) =>
                onChannelsChange({ ...channels, inApp: c === true })
              }
            />
            <Label htmlFor={inAppId}>인앱 알림</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={emailId}
              checked={channels.email}
              onCheckedChange={(c) =>
                onChannelsChange({ ...channels, email: c === true })
              }
            />
            <Label htmlFor={emailId}>이메일 알림</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            SMTP가 설정되지 않으면 이메일은 콘솔/DB로 안전하게 폴백돼요.
          </p>
        </div>
      </Card>

      <InfoBanner tone="info" title="일정 안내">
        단계별 마감일과 D-7/D-3/D-1 리드타임을 저장하면, 알림 생성 시 대상자에게
        독촉 알림이 발송돼요.
      </InfoBanner>
    </div>
  );
}
