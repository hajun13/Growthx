'use client';

/**
 * OrgTabPanels — 사용자 관리 > 조직 구조 탭 상단 요약 2카드(조직 구조 · 정리해야 할 항목).
 * Part/ P4-② — 두 카드 높이를 그리드 items-stretch 로 통일.
 */

import { AlertTriangle, Building2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface OrgHealth {
  groups: number;
  divisions: number;
  teams: number;
  unassignedUsers: { user: { name: string } }[];
  inactiveUsers: unknown[];
  exemptUsers: unknown[];
  headlessNodes: { id: string; name: string }[];
}

interface Props {
  health: OrgHealth;
  memberCount: number;
  reassignBusy: boolean;
  onReassign: () => void;
  onFocusDept: (deptId: string) => void;
}

function PanelHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-b border-border">
      <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
        <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">{children}</CardTitle>
        {action}
      </CardHeader>
    </div>
  );
}

export function OrgTabPanels({ health, memberCount, reassignBusy, onReassign, onFocusDept }: Props) {
  return (
    <div className="gx-workbench-grid items-stretch">
      <Card className="flex flex-col">
        <PanelHeader
          action={
            <Button variant="outline" size="sm" loading={reassignBusy} onClick={onReassign}>
              <RefreshCw aria-hidden />부서장 평가 재배정
            </Button>
          }
        >
          <span className="flex items-center gap-2">
            <Building2 size={16} className="text-primary" aria-hidden />
            조직 구조 (그룹 → 본부 → 팀)
          </span>
        </PanelHeader>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col justify-between gap-3">
            <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
              <OrgMetric label="그룹" value={`${health.groups}개`} />
              <OrgMetric label="본부" value={`${health.divisions}개`} />
              <OrgMetric label="팀" value={`${health.teams}개`} />
              <OrgMetric label="소속 인원" value={`${memberCount}명`} />
            </div>
            <p className="text-12 leading-relaxed text-muted-foreground">
              트리에서 부서를 선택하면 상세가 열립니다. 조직 변경 후에는 시작 전 부서장 평가만 재배정할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <PanelHeader>정리해야 할 항목</PanelHeader>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col justify-between gap-3">
            <OrgIssue
              ok={health.unassignedUsers.length === 0}
              title="소속 미지정 사용자"
              value={`${health.unassignedUsers.length}명`}
              text={
                health.unassignedUsers.length === 0
                  ? '모든 사용자가 조직에 연결되어 있습니다.'
                  : health.unassignedUsers.slice(0, 3).map((row) => row.user.name).join(', ')
              }
            />
            <OrgIssue
              ok={health.headlessNodes.length === 0}
              title="부서장 미지정 조직"
              value={`${health.headlessNodes.length}개`}
              text={
                health.headlessNodes.length === 0
                  ? '활성 구성원이 있는 조직의 부서장(headUserId) 지정이 정리되어 있습니다.'
                  : ''
              }
              items={health.headlessNodes.slice(0, 6).map((node) => ({
                id: node.id,
                label: node.name,
                onClick: () => onFocusDept(node.id),
              }))}
              moreCount={Math.max(0, health.headlessNodes.length - 6)}
            />
            <OrgIssue
              ok={health.inactiveUsers.length === 0 && health.exemptUsers.length === 0}
              title="평가 대상 예외"
              value={`${health.inactiveUsers.length + health.exemptUsers.length}명`}
              text={`비활성 ${health.inactiveUsers.length}명 · 평가제외 ${health.exemptUsers.length}명`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-11 font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-16 font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function OrgIssue({
  ok,
  title,
  value,
  text,
  items,
  moreCount = 0,
}: {
  ok: boolean;
  title: string;
  value: string;
  text: string;
  /** 클릭 가능한 대상 목록(예: 부서장 미지정 조직 → 해당 부서로 이동). text 대신 렌더. */
  items?: { id: string; label: string; onClick: () => void }[];
  moreCount?: number;
}) {
  const hasItems = !!items && items.length > 0;
  return (
    <div className="flex gap-3">
      <span
        className={
          ok
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground'
            : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-warning-300 bg-warning-50 text-warning-700'
        }
      >
        {ok ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-13 font-bold text-foreground">{title}</span>
          <span className="text-12 font-bold tabular-nums text-muted-foreground">{value}</span>
        </span>
        {hasItems ? (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {items.map((it) => (
              <Button
                key={it.id}
                variant="outline"
                size="xs"
                onClick={it.onClick}
                title={`${it.label} — 조직 구조에서 열기`}
              >
                {it.label}
              </Button>
            ))}
            {moreCount > 0 && (
              <span className="text-11h text-muted-foreground">외 {moreCount}개</span>
            )}
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-12 leading-relaxed text-muted-foreground">{text}</span>
        )}
      </span>
    </div>
  );
}
