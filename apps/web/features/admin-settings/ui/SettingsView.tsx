'use client';

// 개인 설정 — 전 직원 접근. 알림 발송 안내 + 비밀번호 변경.
// (평가 기간·일정·대상자 등 운영 설정은 사이드바 '평가 운영' /admin/cycle 으로 분리됨.)
import { useMemo, useState, useId } from 'react';
import {
  Bell, KeyRound, ShieldCheck, Eye, EyeOff, Lightbulb, Check,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InfoBanner } from '@/components/InfoBanner';
import { HelpTooltip } from '@/components/HelpTooltip';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordPolicyChecklist, type PasswordRule } from '@/components/PasswordPolicyChecklist';
import { cn } from '@/lib/utils';
import { useSettingsData } from '../hooks';

type TabKey = 'notification' | 'password';
const MENU: { key: TabKey; label: string; Icon: typeof Bell }[] = [
  { key: 'notification', label: '알림 설정',     Icon: Bell },
  { key: 'password',     label: '비밀번호 변경', Icon: KeyRound },
];

// ── 알림 발송 안내 (개인별 수신 설정은 서버 미지원 — 준비 중) ─────────────────
// 과거에는 토글을 localStorage 에 저장했으나 서버 발송과 연동되지 않는 no-op 이라
// "저장했는데 반영 안 됨" 오인을 낳았다. 실제 연동 전까지 읽기 전용 안내로 표시한다.
const NOTIF_CHANNELS = [
  { key: 'email',    label: '이메일 알림', desc: '평가 관련 주요 이벤트를 이메일로 발송합니다.' },
  { key: 'system',   label: '시스템 알림', desc: '시스템 내 알림함에 알림을 표시합니다.' },
  { key: 'deadline', label: '마감 알림',   desc: '평가 마감 D-7/D-3/D-1 알림을 발송합니다.' },
  { key: 'approval', label: '승인 알림',   desc: 'KPI 및 평가 승인·반려 시 알림을 발송합니다.' },
] as const;

// ── 비밀번호 입력 필드 ────────────────────────────────────────────────────────
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
        />
        {ok && !error && (
          <Check
            size={15}
            className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-success-700"
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
          className="absolute right-1.5 top-1/2 flex h-6 w-7 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

// ── 비밀번호 강도 미터 ────────────────────────────────────────────────────────
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

const STRENGTH_META = [
  { label: '없음',  cls: 'text-muted-foreground',   barCls: 'bg-border' },
  { label: '약함',  cls: 'text-destructive',         barCls: 'bg-destructive' },
  { label: '보통',  cls: 'text-warning-700',         barCls: 'bg-warning-500' },
  { label: '양호',  cls: 'text-primary',             barCls: 'bg-primary' },
  { label: '강함',  cls: 'text-success-700',         barCls: 'bg-success-500' },
] as const;

function StrengthMeter({ value }: { value: number }) {
  const meta = STRENGTH_META[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">비밀번호 강도</span>
        <span className={`text-[11.5px] font-bold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className={cn('h-1 flex-1 rounded-sm transition-colors duration-200', seg <= value ? meta.barCls : 'bg-border/40')}
          />
        ))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function SettingsView() {
  const { user, changePassword } = useSettingsData();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('notification');

  // 비밀번호 변경
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
      <PageHeader title="설정" subtitle="알림 발송 안내를 확인하고 계정 비밀번호를 관리합니다." />

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* 좌측 탭 메뉴 */}
        <Card className="self-start overflow-hidden p-0">
          {MENU.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 transition-colors',
                  isActive
                    ? 'border-l-[3px] border-l-primary bg-muted'
                    : 'border-l-[3px] border-l-transparent hover:bg-muted/70',
                )}
              >
                <span className={cn(
                  'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[4px]',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  <Icon size={14} aria-hidden />
                </span>
                <span className={cn('text-[12.5px]', isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>
                  {label}
                </span>
              </button>
            );
          })}
        </Card>

        {/* 우측 콘텐츠 */}
        <Card className="overflow-hidden p-0">
          {/* 알림 설정 */}
          {activeTab === 'notification' && (
            <>
              <div className="flex items-center gap-2.5 border-b border-border bg-muted px-6 py-4">
                <Bell size={17} className="text-primary" aria-hidden />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[14px] font-bold text-foreground">알림 설정</h3>
                    <HelpTooltip
                      label="알림 설정 설명 보기"
                      content="개인별 수신 설정 기능은 준비 중이에요. 지금은 모든 알림이 시스템 기본값으로 발송됩니다. SMTP 미설정 시 이메일은 콘솔/DB로 안전하게 폴백됩니다."
                    />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">평가 관련 알림이 어떻게 발송되는지 안내해요.</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-6">
                <InfoBanner tone="info" title="개인별 알림 수신 설정은 준비 중이에요">
                  지금은 아래 알림이 모두 시스템 기본값으로 발송되고, 개별로 켜고 끌 수 없어요. 수신 설정 기능이 열리면 이 화면에서 바로 관리할 수 있게 됩니다.
                </InfoBanner>
                <div className="grid gap-3 md:grid-cols-2">
                  {NOTIF_CHANNELS.map((n) => (
                    <div
                      key={n.key}
                      className="flex min-h-[86px] w-full items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-4 py-3.5"
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">{n.label}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">{n.desc}</div>
                      </div>
                      <span className="shrink-0 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        기본값 발송
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 비밀번호 변경 */}
          {activeTab === 'password' && (
            <>
              <div className="flex items-center gap-2.5 border-b border-border bg-muted px-6 py-4">
                <KeyRound size={17} className="text-primary" aria-hidden />
                <div>
                  <h3 className="text-[14px] font-bold text-foreground">비밀번호 변경</h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다.</p>
                </div>
              </div>

              {/* 보안 안내 배너 */}
              <div className="mx-6 mt-6 flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                  <ShieldCheck size={18} aria-hidden />
                </span>
                <div>
                  <div className="text-[12.5px] font-bold text-foreground">안전한 계정을 위해 주기적으로 변경해 주세요</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">다른 사이트와 다른 비밀번호를 사용하는 것이 가장 안전해요.</div>
                </div>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,460px)_minmax(260px,1fr)]">
                <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleChangePassword(); }}>
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

                  <InfoBanner tone="tip">
                    <span className="flex items-center gap-1.5">
                      <Lightbulb size={14} aria-hidden />
                      대문자·숫자·특수문자를 섞고, 12자 이상으로 만들면 더 안전해요. 이름·생일·전화번호 같은 개인정보는 피해 주세요.
                    </span>
                  </InfoBanner>

                  <Button type="submit" fullWidth size="lg" loading={pwBusy} disabled={!pwReady}>
                    비밀번호 변경
                  </Button>
                </form>
                <div className="rounded-md border border-border bg-muted/40 p-4">
                  <p className="text-[12px] font-bold text-foreground">변경 전 확인</p>
                  <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                    <li>현재 비밀번호를 입력해야 변경할 수 있어요.</li>
                    <li>새 비밀번호는 초기값이나 현재 비밀번호와 달라야 해요.</li>
                    <li>변경 후에는 같은 브라우저에서 바로 새 비밀번호 정책이 적용돼요.</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
