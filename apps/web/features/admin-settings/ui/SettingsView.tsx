'use client';

// 개인 설정 — 전 직원 접근. 알림 수신 설정(본인) + 비밀번호 변경.
// (평가 기간·일정·대상자 등 운영 설정은 사이드바 '평가 운영' /admin/cycle 으로 분리됨.)
// 데이터 소스: features/admin-settings 슬라이스(useSettingsData → 생성 클라이언트 authControllerMe).
import { useMemo, useState, useEffect, useId } from 'react';
import { Bell, KeyRound, ChevronRight, ShieldCheck, Eye, EyeOff, Lightbulb, Check } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordPolicyChecklist, type PasswordRule } from '@/components/PasswordPolicyChecklist';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useSettingsData } from '../hooks';

const K = {
  primary:   '#3f2c80',
  secondary: '#0054ca',
  tertiary:  '#0e9aa0',
} as const;

const T = {
  grey900: '#191c1f',
  grey600: '#484551',
  grey500: '#797582',
  grey400: '#b0b8c1',
  grey200: '#e5e8eb',
  grey100: '#f2f4f6',
  red500:  '#f04452',
  green500:'#03b26c',
} as const;

type TabKey = 'notification' | 'password';
const MENU: { key: TabKey; label: string; Icon: typeof Bell; bg: string }[] = [
  { key: 'notification', label: '알림 설정',     Icon: Bell,     bg: K.secondary },
  { key: 'password',     label: '비밀번호 변경', Icon: KeyRound, bg: '#484551' },
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

// §6-6 토글 스위치
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 40, height: 22, flexShrink: 0,
        border: `1px solid ${on ? K.secondary : T.grey400}`,
        background: on ? K.secondary : T.grey200,
        borderRadius: 11, cursor: 'pointer', padding: 0,
        transition: 'background .15s ease, border-color .15s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 16, height: 16, background: '#fff', borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: 'left .15s ease',
      }} />
    </button>
  );
}

// 섹션 헤더 — §2-3 패턴
function ContentHeader({ title, desc, icon: Icon }: { title: string; desc?: string; icon?: React.ElementType }) {
  return (
    <div
      className="px-6 py-4 border-b border-[#e7e8ec] flex items-center gap-2.5"
      style={{ background: '#f2f3f7' }}
    >
      {Icon && <Icon size={17} color={K.secondary} />}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{title}</h3>
        {desc && <p style={{ fontSize: 11.5, color: T.grey500, marginTop: 1 }}>{desc}</p>}
      </div>
    </div>
  );
}

// 비밀번호 입력 — 표시/숨김(eye) 토글 내장.
function PasswordField({
  label, value, onChange, autoComplete, required, error, ok,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  required?: boolean;
  error?: string;
  ok?: boolean;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn('pr-16', error && 'border-destructive focus-visible:ring-destructive')}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = K.secondary;
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '';
            e.currentTarget.style.boxShadow = '';
          }}
        />
        {ok && !error && (
          <Check
            size={15}
            className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2"
            style={{ color: K.tertiary }}
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
          className="absolute right-1.5 top-1/2 flex h-6 w-7 -translate-y-1/2 items-center justify-center transition-colors"
          style={{ color: T.grey500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.grey900)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.grey500)}
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: T.red500, marginTop: 3 }}>{error}</p>}
    </div>
  );
}

// 비밀번호 강도(0~4)
function pwStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH_META: { label: string; color: string }[] = [
  { label: '없음', color: 'rgba(202,196,210,0.6)' },
  { label: '약함', color: '#ba1a1a' },
  { label: '보통', color: '#b45309' },
  { label: '양호', color: K.secondary },
  { label: '강함', color: K.tertiary },
];

function StrengthMeter({ value }: { value: number }) {
  const meta = STRENGTH_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11.5, color: T.grey500 }}>비밀번호 강도</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: seg <= value ? meta.color : 'rgba(202,196,210,0.4)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function SettingsView() {
  const { user, changePassword } = useSettingsData();
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
      { key: 'len',    label: `${MIN_LEN}자 이상이에요`,           passed: newPw.length >= MIN_LEN },
      { key: 'banned', label: '"1234" 같은 쉬운 값이 아니에요',   passed: newPw.length > 0 && !banned },
      { key: 'diff',   label: '현재 비밀번호와 달라요',           passed: newPw.length > 0 && newPw !== curPw },
      { key: 'match',  label: '두 번 입력한 값이 같아요',         passed: confirmPw.length > 0 && newPw === confirmPw },
    ];
  }, [curPw, newPw, confirmPw]);
  const pwReady = rules.every((r) => r.passed) && curPw.length > 0;
  const strength = useMemo(() => pwStrength(newPw), [newPw]);
  const confirmOk = confirmPw.length > 0 && newPw === confirmPw;

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
        {/* 좌측 메뉴 — §4-5 패턴 */}
        <div
          className="overflow-hidden"
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            borderRadius: 12,
            background: '#fff',
            alignSelf: 'start',
            boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
          }}
        >
          {MENU.map(({ key, label, Icon, bg }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-all last:border-b-0"
                style={{
                  background: isActive ? '#f2f3f7' : '#fff',
                  borderColor: 'rgba(202,196,210,0.3)',
                  borderLeft: `3px solid ${isActive ? bg : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f8f9fd'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = '#fff'; }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ width: 30, height: 30, background: bg, borderRadius: 6 }}
                >
                  <Icon size={14} color="#fff" />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? T.grey900 : T.grey600 }}>
                  {label}
                </span>
                <ChevronRight size={13} color={isActive ? T.grey900 : T.grey400} className="ml-auto" />
              </button>
            );
          })}
        </div>

        {/* 우측 콘텐츠 */}
        <div
          className="overflow-hidden"
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
          }}
        >
          {/* 알림 설정 */}
          {activeTab === 'notification' && (
            <>
              <ContentHeader icon={Bell} title="알림 설정" desc="내가 받을 평가 관련 알림을 직접 켜고 끌 수 있어요." />
              <div style={{ padding: 24 }} className="space-y-3">
                {([
                  { key: 'email'    as const, label: '이메일 알림', desc: '평가 관련 주요 이벤트를 이메일로 수신합니다.' },
                  { key: 'system'   as const, label: '시스템 알림', desc: '시스템 내 알림을 표시합니다.' },
                  { key: 'deadline' as const, label: '마감 알림',   desc: '평가 마감 D-7/D-3/D-1 알림을 받습니다.' },
                  { key: 'approval' as const, label: '승인 알림',   desc: 'KPI 및 평가 승인·반려 시 알림을 받습니다.' },
                ] as { key: keyof NotifSettings; label: string; desc: string }[]).map((n) => (
                  <div
                    key={n.key}
                    className="flex items-center justify-between transition-colors"
                    style={{
                      border: '1px solid rgba(202,196,210,0.5)',
                      padding: '14px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleNotif(n.key)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(63,44,128,0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(202,196,210,0.5)')}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{n.label}</div>
                      <div style={{ fontSize: 11.5, color: T.grey500, marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <Toggle on={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
                  </div>
                ))}
                <div
                  className="flex items-start gap-2 rounded-xl px-4 py-3"
                  style={{ background: '#f8f9fd', border: '1px solid rgba(202,196,210,0.4)' }}
                >
                  <Lightbulb size={14} color="#b45309" className="mt-0.5 shrink-0" />
                  <p style={{ fontSize: 11.5, color: T.grey500, lineHeight: 1.5 }}>
                    알림 설정은 이 브라우저의 내 계정에만 적용됩니다. SMTP 미설정 시 이메일은 콘솔/DB로 안전하게 폴백됩니다.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 비밀번호 변경 */}
          {activeTab === 'password' && (
            <>
              <ContentHeader icon={KeyRound} title="비밀번호 변경" desc="현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다." />

              {/* 보안 안내 배너 */}
              <div
                className="flex items-center gap-3 mx-6 mt-6 mb-0 rounded-xl px-4 py-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,84,202,0.06) 0%, rgba(63,44,128,0.06) 100%)',
                  border: '1px solid rgba(0,84,202,0.2)',
                }}
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, background: K.secondary }}
                >
                  <ShieldCheck size={18} color="#fff" />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}>
                    안전한 계정을 위해 주기적으로 변경해 주세요
                  </div>
                  <div style={{ fontSize: 11.5, color: T.grey500, marginTop: 1 }}>
                    다른 사이트와 다른 비밀번호를 사용하는 것이 가장 안전해요.
                  </div>
                </div>
              </div>

              <div style={{ padding: 24, maxWidth: 460 }}>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => { e.preventDefault(); void handleChangePassword(); }}
                >
                  <PasswordField
                    label="현재 비밀번호"
                    value={curPw}
                    onChange={(v) => { setCurPw(v); setPwError(null); }}
                    autoComplete="current-password"
                    required
                    error={pwError ?? undefined}
                  />

                  <div className="flex flex-col gap-2.5">
                    <PasswordField
                      label="새 비밀번호"
                      value={newPw}
                      onChange={setNewPw}
                      autoComplete="new-password"
                      required
                    />
                    {newPw.length > 0 && <StrengthMeter value={strength} />}
                  </div>

                  <PasswordField
                    label="새 비밀번호 확인"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    autoComplete="new-password"
                    required
                    ok={confirmOk}
                    error={confirmPw.length > 0 && !confirmOk ? '비밀번호가 일치하지 않아요.' : undefined}
                  />

                  <PasswordPolicyChecklist rules={rules} />

                  {/* 보안 팁 */}
                  <div
                    className="flex items-start gap-2 rounded-xl px-4 py-3"
                    style={{ background: '#f8f9fd', border: '1px solid rgba(202,196,210,0.4)' }}
                  >
                    <Lightbulb size={14} color="#b45309" className="mt-0.5 shrink-0" />
                    <span style={{ fontSize: 11.5, lineHeight: 1.5, color: T.grey500 }}>
                      대문자·숫자·특수문자를 섞고, 12자 이상으로 만들면 더 안전해요.
                      이름·생일·전화번호 같은 개인정보는 피해 주세요.
                    </span>
                  </div>

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
