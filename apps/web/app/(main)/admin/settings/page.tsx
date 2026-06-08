'use client';

// 개인 설정 — 전 직원 접근. 알림 수신 설정(본인) + 비밀번호 변경.
// (평가 기간·일정·대상자 등 운영 설정은 사이드바 '평가 운영' /admin/cycle 으로 분리됨.)
import { useMemo, useState, useEffect } from 'react';
import { Bell, KeyRound, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { PasswordPolicyChecklist, type PasswordRule } from '@/components/PasswordPolicyChecklist';
import { T } from '@/lib/toss';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

type TabKey = 'notification' | 'password';
const MENU: { key: TabKey; label: string; Icon: typeof Bell; bg: string }[] = [
  { key: 'notification', label: '알림 설정',     Icon: Bell,     bg: T.blue500 },
  { key: 'password',     label: '비밀번호 변경', Icon: KeyRound, bg: T.grey800 },
];

// ── 알림 토글 설정(localStorage, 본인 전용) ──
const NOTIF_KEY = 'energyx:notif-settings';
type NotifSettings = { email: boolean; system: boolean; deadline: boolean; approval: boolean };
const NOTIF_DEFAULTS: NotifSettings = { email: true, system: true, deadline: true, approval: false };
function loadNotifSettings(): NotifSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(NOTIF_KEY) : null;
    return raw ? { ...NOTIF_DEFAULTS, ...(JSON.parse(raw) as Partial<NotifSettings>) } : NOTIF_DEFAULTS;
  } catch {
    return NOTIF_DEFAULTS;
  }
}
function saveNotifSettings(s: NotifSettings) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 44, height: 24,
        background: on ? T.blue500 : T.grey400, border: 'none',
        cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
        background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: 'left 0.15s',
      }} />
    </button>
  );
}

function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{title}</h3>
      {desc && <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{desc}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('notification');

  // ── 알림 설정 ──
  const [notifs, setNotifs] = useState<NotifSettings>(NOTIF_DEFAULTS);
  useEffect(() => { setNotifs(loadNotifSettings()); }, []);
  function toggleNotif(key: keyof NotifSettings) {
    setNotifs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifSettings(next);
      return next;
    });
  }

  // ── 비밀번호 변경 ──
  const MIN_LEN = 8;
  const BANNED = ['1234', 'password'];
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const rules: PasswordRule[] = useMemo(() => {
    const banned = BANNED.some((b) => newPw.toLowerCase() === b.toLowerCase());
    return [
      { key: 'len', label: `${MIN_LEN}자 이상이에요`, passed: newPw.length >= MIN_LEN },
      { key: 'banned', label: '"1234" 같은 쉬운 값이 아니에요', passed: newPw.length > 0 && !banned },
      { key: 'diff', label: '현재 비밀번호와 달라요', passed: newPw.length > 0 && newPw !== curPw },
      { key: 'match', label: '두 번 입력한 값이 같아요', passed: confirmPw.length > 0 && newPw === confirmPw },
    ];
  }, [curPw, newPw, confirmPw]);
  const pwReady = rules.every((r) => r.passed) && curPw.length > 0;

  async function handleChangePassword() {
    if (!pwReady || pwBusy) return;
    setPwBusy(true);
    setPwError(null);
    try {
      await changePassword(curPw, newPw);
      toast.show({ variant: 'success', message: '비밀번호를 변경했어요.' });
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '비밀번호 변경에 실패했어요.';
      setPwError(msg);
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setPwBusy(false);
    }
  }

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="설정"
        subtitle="내 알림 수신과 계정 비밀번호를 관리합니다."
      />

      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* 좌측 메뉴 */}
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff', alignSelf: 'start' }}>
          {MENU.map(({ key, label, Icon, bg }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-all last:border-b-0"
                style={{
                  background: isActive ? T.grey100 : '#fff',
                  borderColor: T.grey200,
                  borderLeft: `3px solid ${isActive ? bg : 'transparent'}`,
                }}
              >
                <span className="flex items-center justify-center" style={{ width: 30, height: 30, background: bg }}>
                  <Icon size={14} color="#fff" />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? T.grey900 : T.grey700 }}>
                  {label}
                </span>
                <ChevronRight size={13} color={isActive ? T.grey900 : T.grey400} className="ml-auto" />
              </button>
            );
          })}
        </div>

        {/* 우측 콘텐츠 */}
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff', overflow: 'hidden' }}>
          {/* 알림 설정 */}
          {activeTab === 'notification' && (
            <>
              <ContentHeader title="알림 설정" desc="내가 받을 평가 관련 알림을 직접 켜고 끌 수 있어요." />
              <div style={{ padding: 24 }} className="space-y-3">
                {([
                  { key: 'email'    as const, label: '이메일 알림', desc: '평가 관련 주요 이벤트를 이메일로 수신합니다.' },
                  { key: 'system'   as const, label: '시스템 알림', desc: '시스템 내 알림을 표시합니다.' },
                  { key: 'deadline' as const, label: '마감 알림',   desc: '평가 마감 D-7/D-3/D-1 알림을 받습니다.' },
                  { key: 'approval' as const, label: '승인 알림',   desc: 'KPI 및 평가 승인·반려 시 알림을 받습니다.' },
                ] as { key: keyof NotifSettings; label: string; desc: string }[]).map((n) => (
                  <div
                    key={n.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: `1px solid ${T.grey200}`, padding: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{n.label}</div>
                      <div style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <Toggle on={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: T.grey400, paddingTop: 4 }}>
                  알림 설정은 이 브라우저의 내 계정에만 적용됩니다. SMTP 미설정 시 이메일은 콘솔/DB로 안전하게 폴백됩니다.
                </p>
              </div>
            </>
          )}

          {/* 비밀번호 변경 */}
          {activeTab === 'password' && (
            <>
              <ContentHeader title="비밀번호 변경" desc="현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다." />
              <div style={{ padding: 24, maxWidth: 440 }}>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => { e.preventDefault(); void handleChangePassword(); }}
                >
                  <TextField
                    label="현재 비밀번호"
                    type="password"
                    value={curPw}
                    onChange={(v) => { setCurPw(v); setPwError(null); }}
                    required
                    error={pwError ?? undefined}
                  />
                  <TextField label="새 비밀번호" type="password" value={newPw} onChange={setNewPw} required />
                  <TextField label="새 비밀번호 확인" type="password" value={confirmPw} onChange={setConfirmPw} required />
                  <PasswordPolicyChecklist rules={rules} />
                  <Button type="submit" fullWidth size="lg" loading={pwBusy} disabled={!pwReady}>
                    비밀번호 변경
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
