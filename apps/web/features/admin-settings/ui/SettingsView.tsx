'use client';

// 개인 설정 — 전 직원 접근. 알림 발송 안내.
// (평가 기간·일정·대상자 등 운영 설정은 사이드바 '평가 운영' /admin/cycle 으로 분리됨.)
// (비밀번호 변경은 최초 로그인 온보딩 강제 흐름에서만 처리 — 자발적 변경 화면은 제거됨.)
import { Bell } from 'lucide-react';
import { Card } from '@/components/Card';
import { InfoBanner } from '@/components/InfoBanner';
import { HelpTooltip } from '@/components/HelpTooltip';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useSettingsData } from '../hooks';

// ── 알림 발송 안내 (개인별 수신 설정은 서버 미지원 — 준비 중) ─────────────────
// 과거에는 토글을 localStorage 에 저장했으나 서버 발송과 연동되지 않는 no-op 이라
// "저장했는데 반영 안 됨" 오인을 낳았다. 실제 연동 전까지 읽기 전용 안내로 표시한다.
const NOTIF_CHANNELS = [
  { key: 'email',    label: '이메일 알림', desc: '평가 관련 주요 이벤트를 이메일로 발송합니다.' },
  { key: 'system',   label: '시스템 알림', desc: '시스템 내 알림함에 알림을 표시합니다.' },
  { key: 'deadline', label: '마감 알림',   desc: '평가 마감 D-7/D-3/D-1 알림을 발송합니다.' },
  { key: 'approval', label: '승인 알림',   desc: 'KPI 및 평가 승인·반려 시 알림을 발송합니다.' },
] as const;

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function SettingsView() {
  const { user } = useSettingsData();

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader title="설정" subtitle="평가 관련 알림이 어떻게 발송되는지 안내합니다." />

      <Card className="overflow-hidden p-0">
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
      </Card>
    </PageContainer>
  );
}
