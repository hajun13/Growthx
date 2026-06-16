'use client';

import { Lock, LockOpen, Info } from 'lucide-react';
import { schedulePhaseText } from '@/lib/ui';
import { T } from '@/lib/toss';

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

// ── Toss 인라인 스타일 토큰(평가 운영 페이지·RuleSetEditor 와 동일 패턴) ──
const dateInputStyle: React.CSSProperties = {
  border: `1px solid ${T.grey200}`,
  padding: '7px 10px',
  fontSize: 13,
  color: T.grey900,
  background: '#fff',
  outline: 'none',
};
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11.5,
  fontWeight: 600,
  color: T.grey600,
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: T.grey900,
  verticalAlign: 'middle',
};

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
    <div style={{ border: '1px solid rgba(204,204,212,0.5)', borderRadius: 12, background: '#fff' }}>
      <div style={{ padding: '12px 16px', background: T.grey50, borderBottom: '1px solid #e3e3e8' }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{title}</h4>
        {desc && <p style={{ fontSize: 12, color: T.grey600, marginTop: 2, lineHeight: 1.5 }}>{desc}</p>}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        color: disabled ? T.grey400 : T.grey800,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ width: 15, height: 15, accentColor: T.blue500, cursor: disabled ? 'not-allowed' : 'pointer' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 단계별 마감일·알림 */}
      <Section title="단계별 마감일·알림" desc="각 단계의 마감일과 D-7/D-3/D-1 리드타임 알림을 설정합니다.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.grey200}` }}>
                <th style={thStyle}>단계</th>
                <th style={thStyle}>마감일</th>
                <th style={thStyle}>알림 사용</th>
                <th style={thStyle}>리드타임 (D-7/D-3/D-1)</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.phase} style={{ borderTop: `1px solid ${T.grey100}` }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{schedulePhaseText(p.phase)}</td>
                  <td style={tdStyle}>
                    <input
                      type="date"
                      aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                      value={p.dueDate}
                      onChange={(e) => onPhaseChange(p.phase, { dueDate: e.target.value })}
                      style={dateInputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <Check
                      label={`${schedulePhaseText(p.phase)} 알림 사용`}
                      checked={p.notifyEnabled}
                      onChange={() => onPhaseChange(p.phase, { notifyEnabled: !p.notifyEnabled })}
                    />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 14 }}>
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
          <p style={{ marginTop: 10, fontSize: 12.5, fontWeight: 500, color: '#9a6103' }}>
            앞 단계 마감일이 뒤 단계보다 늦어요. 단계 순서를 확인해 주세요.
          </p>
        )}
      </Section>

      {/* M3 Item 5: 평가 기간 관리 — 시작/마감 + 잠금 토글 */}
      <Section
        title="평가 기간 관리 (잠금/열기)"
        desc="각 단계의 시작·마감일을 정하고, 잠그면 해당 기간의 KPI 작성·수정이 차단돼요. 잠금/열기는 즉시 적용되며, 다시 열 때(재오픈)는 사유를 입력해야 해요."
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.grey200}` }}>
                <th style={thStyle}>단계</th>
                <th style={thStyle}>시작일</th>
                <th style={thStyle}>마감일</th>
                <th style={thStyle}>상태</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => {
                const locked = p.isLocked ?? false;
                const busy = lockBusyPhase === p.phase;
                return (
                  <tr key={`lock-${p.phase}`} style={{ borderTop: `1px solid ${T.grey100}` }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{schedulePhaseText(p.phase)}</td>
                    <td style={tdStyle}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 시작일`}
                        value={p.startDate ?? ''}
                        onChange={(e) => onPhaseChange(p.phase, { startDate: e.target.value })}
                        style={dateInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="date"
                        aria-label={`${schedulePhaseText(p.phase)} 마감일`}
                        value={p.dueDate}
                        onChange={(e) => onPhaseChange(p.phase, { dueDate: e.target.value })}
                        style={dateInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        aria-pressed={locked}
                        disabled={busy}
                        aria-label={`${schedulePhaseText(p.phase)} ${locked ? '잠김 — 열기' : '열림 — 잠그기'}`}
                        onClick={() => onToggleLock(p.phase, !locked)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                          border: `1px solid ${locked ? '#f59e0b' : '#c9eed7'}`,
                          background: locked ? '#fef5e7' : '#e9f8ef',
                          color: locked ? '#9a6103' : T.green500,
                        }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Check
            label="인앱 알림"
            checked={channels.inApp}
            onChange={() => onChannelsChange({ ...channels, inApp: !channels.inApp })}
          />
          <Check
            label="이메일 알림"
            checked={channels.email}
            onChange={() => onChannelsChange({ ...channels, email: !channels.email })}
          />
          <p style={{ fontSize: 11.5, color: T.grey600 }}>
            SMTP가 설정되지 않으면 이메일은 콘솔/DB로 안전하게 폴백돼요.
          </p>
        </div>
      </Section>

      {/* 안내 노트 — InfoBanner info 톤과 동일 색(인라인) */}
      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          border: '1px solid #CDDDFB',
          background: '#EAF1FE',
          color: '#173F9B',
          padding: '12px 14px',
        }}
      >
        <Info size={18} style={{ flexShrink: 0, marginTop: 1, color: '#1D4FC4' }} aria-hidden />
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ fontWeight: 700 }}>일정 안내</p>
          <p style={{ marginTop: 2, opacity: 0.9 }}>
            단계별 마감일과 <b>알림 사용</b>·<b>D-7/D-3/D-1</b> 리드타임을 저장하면, 매일 자동으로 마감일 기준
            리마인더가 대상자에게 발송돼요. <b>알림 사용</b>을 끈 단계는 보내지 않고, 같은 D-N은 한 번만 보내요.
            바로 보내려면 아래 <b>‘마감 리마인더 보내기’</b>를 누르세요.
          </p>
        </div>
      </div>
    </div>
  );
}
