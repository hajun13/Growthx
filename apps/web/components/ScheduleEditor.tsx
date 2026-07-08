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
      {/* 단계별 일정·알림·잠금 — 단일 표(마감일 이중 노출 제거) */}
      <Section
        title="단계별 일정·알림·잠금"
        desc="시작·마감일과 알림은 아래 ‘일정 저장’을 눌러야 반영돼요. 잠금/열기만 즉시 적용되고, 다시 열 때(재오픈)는 사유를 입력해야 해요."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse bg-card">
            <thead>
              <tr className="border-b border-border bg-muted/70">
                <th className={thClass}>단계</th>
                <th className={thClass}>
                  시작일
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">(일정 저장 시 반영)</span>
                </th>
                <th className={thClass}>
                  마감일
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">(일정 저장 시 반영)</span>
                </th>
                <th className={thClass}>
                  알림
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">(일정 저장 시 반영)</span>
                </th>
                <th className={thClass}>
                  잠금
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/80">(즉시 적용)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => {
                const locked = p.isLocked ?? false;
                const busy = lockBusyPhase === p.phase;
                const missingDue = !p.dueDate;
                return (
                  <tr key={p.phase} className="border-t border-border/70 hover:bg-muted/40">
                    <td className={`${tdClass} font-semibold`}>{schedulePhaseText(p.phase)}</td>
                    <td className={tdClass}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 시작일`}
                        value={p.startDate ?? ''}
                        max={p.dueDate || undefined}
                        onChange={(e) => onPhaseChange(p.phase, { startDate: e.target.value })}
                        className={dateInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                        value={p.dueDate}
                        min={p.startDate || undefined}
                        onChange={(e) => onPhaseChange(p.phase, { dueDate: e.target.value })}
                        className={dateInputClass}
                      />
                      {missingDue && (
                        <p className="mt-1 text-[11px] font-semibold text-warning-700">
                          마감일을 입력해야 저장돼요
                        </p>
                      )}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                        <Check
                          label={`${schedulePhaseText(p.phase)} 알림 사용`}
                          checked={p.notifyEnabled}
                          onChange={() => onPhaseChange(p.phase, { notifyEnabled: !p.notifyEnabled })}
                        />
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
                    <td className={tdClass}>
                      {/* 상태 배지 + 액션 버튼 2요소 분리 — 라벨이 곧 토글이던 모호함 제거 */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-6 items-center gap-1 rounded-sm px-2 text-[11.5px] font-semibold ${
                            locked
                              ? 'bg-warning-50 text-warning-700'
                              : 'bg-success-50 text-success-700'
                          }`}
                        >
                          {locked ? <Lock size={12} aria-hidden /> : <LockOpen size={12} aria-hidden />}
                          {locked ? '잠김' : '열림'}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`${schedulePhaseText(p.phase)} 단계 ${locked ? '열기' : '잠그기'}`}
                          onClick={() => onToggleLock(p.phase, !locked)}
                          className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? '처리 중…' : locked ? '열기' : '잠그기'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {orderWarning && (
          <p className="mt-2.5 text-[12.5px] font-semibold text-warning-700">
            앞 단계 마감일이 뒤 단계보다 늦어요. 단계 순서를 확인해 주세요.
          </p>
        )}
      </Section>

      {/* 알림 채널 — 저장과 연동되지 않던 체크박스(no-op)를 읽기 전용 안내로 정직화 */}
      <InfoBanner tone="info" title="알림 채널">
        알림은 인앱+이메일로 발송돼요. (채널별 끄기는 준비 중이에요) SMTP가 설정되지
        않으면 이메일은 콘솔/DB로 안전하게 폴백돼요.
      </InfoBanner>

      <InfoBanner tone="info" title="일정 안내">
        단계별 마감일과 알림 사용·D-7/D-3/D-1 리드타임을 저장하면 매일 자동으로 리마인더가 발송돼요.
        알림 사용을 끈 단계는 보내지 않고, 같은 D-N은 한 번만 보내요. 바로 보내려면 아래 ‘마감 리마인더 보내기’를 누르세요.
      </InfoBanner>
    </div>
  );
}
