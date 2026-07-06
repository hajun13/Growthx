'use client';

import { Lock, LockOpen } from 'lucide-react';
import { InfoBanner } from '@/components/InfoBanner';
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

const dateInputClass =
  'h-8 rounded-md border border-input bg-background px-2.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30';
const thClass =
  'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const tdClass = 'px-3 py-2.5 align-middle text-[13px] text-foreground';

// 섹션 컨테이너 — grey50 헤더 바 + 본문(평가 기간/과거결과 탭과 동일).
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      <div className="border-b border-border bg-muted px-4 py-3">
        <h4 className="text-[13px] font-bold text-foreground">{title}</h4>
        {desc && <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// 단계별 체크박스 — 페이지 전반의 네이티브 인풋과 톤을 맞춤(accentColor 블루).
function Check({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-[13px] ${
        disabled ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer text-foreground'
      }`}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-[15px] w-[15px] accent-primary"
      />
      {label}
    </label>
  );
}

export function ScheduleEditor({
  phases,
  onPhaseChange,
  channels,
  onChannelsChange,
  onToggleLock,
  lockBusyPhase,
}: ScheduleEditorProps) {
  // 마감일 단조성(이전 단계 마감 ≤ 다음 단계 마감) 검증.
  const orderWarning = phases.some((p, i) => {
    if (i === 0) return false;
    const prev = phases[i - 1].dueDate;
    return prev && p.dueDate && prev > p.dueDate;
  });

  return (
    <div className="grid gap-4">
      {/* 단계별 마감일·알림 */}
      <Section title="단계별 마감일·알림" desc="각 단계의 마감일과 D-7/D-3/D-1 리드타임 알림을 설정합니다.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse bg-card">
            <thead>
              <tr className="border-b border-border bg-muted/70">
                <th className={thClass}>단계</th>
                <th className={thClass}>마감일</th>
                <th className={thClass}>알림 사용</th>
                <th className={thClass}>리드타임</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.phase} className="border-t border-border/70 hover:bg-muted/40">
                  <td className={`${tdClass} font-semibold`}>{schedulePhaseText(p.phase)}</td>
                  <td className={tdClass}>
                    <input
                      type="date"
                      aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                      value={p.dueDate}
                      onChange={(e) => onPhaseChange(p.phase, { dueDate: e.target.value })}
                      className={dateInputClass}
                    />
                  </td>
                  <td className={tdClass}>
                    <Check
                      label={`${schedulePhaseText(p.phase)} 알림 사용`}
                      checked={p.notifyEnabled}
                      onChange={() => onPhaseChange(p.phase, { notifyEnabled: !p.notifyEnabled })}
                    />
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-x-3.5 gap-y-1">
                      {OFFSETS.map((off) => (
                        <Check
                          key={off}
                          label={`D-${off}`}
                          checked={p.notifyOffsets.includes(off)}
                          disabled={!p.notifyEnabled}
                          onChange={() =>
                            onPhaseChange(p.phase, {
                              notifyOffsets: toggleOffset(p.notifyOffsets, off),
                            })
                          }
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orderWarning && (
          <p className="mt-2.5 text-[12.5px] font-semibold text-warning-700">
            앞 단계 마감일이 뒤 단계보다 늦어요. 단계 순서를 확인해 주세요.
          </p>
        )}
      </Section>

      {/* M3 Item 5: 평가 기간 관리 — 시작/마감 + 잠금 토글 */}
      <Section
        title="평가 기간 관리 (잠금/열기)"
        desc="각 단계의 시작·마감일을 정하고, 잠그면 해당 기간의 KPI 작성·수정이 차단돼요. 잠금/열기는 즉시 적용되며, 다시 열 때(재오픈)는 사유를 입력해야 해요."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse bg-card">
            <thead>
              <tr className="border-b border-border bg-muted/70">
                <th className={thClass}>단계</th>
                <th className={thClass}>시작일</th>
                <th className={thClass}>마감일</th>
                <th className={thClass}>상태</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => {
                const locked = p.isLocked ?? false;
                const busy = lockBusyPhase === p.phase;
                return (
                  <tr key={`lock-${p.phase}`} className="border-t border-border/70 hover:bg-muted/40">
                    <td className={`${tdClass} font-semibold`}>{schedulePhaseText(p.phase)}</td>
                    <td className={tdClass}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 시작일`}
                        value={p.startDate ?? ''}
                        onChange={(e) => onPhaseChange(p.phase, { startDate: e.target.value })}
                        className={dateInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                        value={p.dueDate}
                        onChange={(e) => onPhaseChange(p.phase, { dueDate: e.target.value })}
                        className={dateInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        aria-pressed={locked}
                        disabled={busy}
                        aria-label={`${schedulePhaseText(p.phase)} ${locked ? '잠김 — 열기' : '열림 — 잠그기'}`}
                        onClick={() => onToggleLock(p.phase, !locked)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          locked
                            ? 'border-warning-100 bg-warning-50 text-warning-700 hover:bg-warning-100'
                            : 'border-success-100 bg-success-50 text-success-700 hover:bg-success-100'
                        }`}
                      >
                        {locked ? <Lock size={13} aria-hidden /> : <LockOpen size={13} aria-hidden />}
                        {busy ? '처리 중…' : locked ? '잠김' : '열림'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 알림 채널 */}
      <Section title="알림 채널">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <Check
              label="인앱 알림"
              checked={channels.inApp}
              onChange={() => onChannelsChange({ ...channels, inApp: !channels.inApp })}
            />
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <Check
              label="이메일 알림"
              checked={channels.email}
              onChange={() => onChannelsChange({ ...channels, email: !channels.email })}
            />
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground sm:col-span-2">
            SMTP가 설정되지 않으면 이메일은 콘솔/DB로 안전하게 폴백돼요.
          </p>
        </div>
      </Section>

      <InfoBanner tone="info" title="일정 안내">
        단계별 마감일과 알림 사용·D-7/D-3/D-1 리드타임을 저장하면 매일 자동으로 리마인더가 발송돼요.
        알림 사용을 끈 단계는 보내지 않고, 같은 D-N은 한 번만 보내요. 바로 보내려면 아래 ‘마감 리마인더 보내기’를 누르세요.
      </InfoBanner>
    </div>
  );
}
