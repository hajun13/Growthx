'use client';

// 평가 규칙 설정(HR) — 현재 주기의 RuleSet(등급 척도·달성률표·그룹풀비율·등급별 인상률·
// 그룹실적 보너스·가중치 정책)을 편집. 인상률·그룹실적 보너스를 회사가 바꾸는 단일 화면.
// 데이터: @growthx/contracts ruleSetsController* (GET/PATCH /rule-sets) — 생성 클라이언트로 이관.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RuleSetEditor,
  validateRuleSet,
  type RuleSetDraft,
} from '@/components/RuleSetEditor';
import { isHrAdmin } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useRuleSetData, ruleSetCommands } from '../hooks';
import { rulesSubtitle, toDraft, toPatchBody } from '../draft';
import { RulesEmpty, RulesForbidden, RulesLoadError } from './RulesStates';
import { RulesSummary } from './RulesSummary';

export function RulesView() {
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const { hasFeature } = usePermissions();
  const allowed = !!user && isHrAdmin(user.role);
  // 저장 엔드포인트(PATCH /rule-sets/:id)는 백엔드에서 '시스템 설정' feature 하나만 요구한다.
  // '등급풀 수정'만 가진 사용자는 저장 시 403이 나므로 canEdit는 '시스템 설정' 단독으로 게이트한다.
  const canEdit = hasFeature('시스템 설정');

  const ruleSetId = current?.ruleSetId ?? null;
  const {
    data: ruleSet,
    loading: rsLoading,
    error,
    reload,
  } = useRuleSetData(allowed ? ruleSetId : null);

  const [draft, setDraft] = useState<RuleSetDraft | null>(null);
  const [measureTab, setMeasureTab] = useState<'amount' | 'rate'>('amount');
  const [busy, setBusy] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  // RuleSet 로드 → 편집 드래프트 초기화(역매핑).
  useEffect(() => {
    if (ruleSet) {
      setDraft(toDraft(ruleSet));
    }
  }, [ruleSet]);

  // 변경 여부 — 저장 버튼 게이트 + 이탈 경고. 원본(ruleSet)을 같은 역매핑으로 비교.
  const dirty = useMemo(
    () => !!ruleSet && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(ruleSet)),
    [draft, ruleSet],
  );

  // 저장하지 않은 변경이 있으면 새로고침/탭 닫기 전에 브라우저 경고.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const validation = useMemo(
    () => (draft ? validateRuleSet(draft) : { ok: false }),
    [draft],
  );
  const validationIssues = useMemo(
    () =>
      Object.entries(validation)
        .filter(([key, value]) => key !== 'ok' && Boolean(value))
        .map(([, value]) => String(value)),
    [validation],
  );

  // 저장 버튼 → 확인 모달(재산정 영향 안내) → 확정 시 실제 PATCH.
  function requestSave() {
    if (!ruleSet || !draft || !canEdit) return;
    const v = validateRuleSet(draft);
    if (!v.ok) {
      toast.error('입력값을 확인해 주세요. 빨간 안내가 있는 항목이 있어요.', {
        duration: 8000,
      });
      return;
    }
    setConfirmSave(true);
  }

  async function handleSave() {
    if (!ruleSet || !draft || !canEdit) return;
    setBusy(true);
    try {
      await ruleSetCommands.update(ruleSet.id, toPatchBody(draft, ruleSet));
      toast.success('평가 규칙을 저장했어요.');
      setConfirmSave(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했어요.', {
        duration: 8000,
      });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed)
    return <RulesForbidden message="평가 규칙은 관리자(HR)만 설정할 수 있어요." />;
  if (cyclesLoading || rsLoading) return <Skeleton className="h-64 w-full" />;

  if (!ruleSetId)
    return (
      <PageContainer>
        <PageHeader title="평가 규칙" subtitle={rulesSubtitle(current?.name)} />
        <RulesEmpty
          title="규칙 세트가 없어요."
          description="현재 주기에 연결된 규칙 세트가 없어요. ‘평가 운영’에서 주기에 규칙을 먼저 연결해 주세요."
        />
      </PageContainer>
    );

  if (error)
    return (
      <PageContainer>
        <PageHeader title="평가 규칙" subtitle={rulesSubtitle(current?.name)} />
        <RulesLoadError message={error.message} onRetry={reload} />
      </PageContainer>
    );

  if (!draft) return <Skeleton className="h-64 w-full" />;

  return (
    <PageContainer>
      <PageHeader
        title="평가 규칙"
        subtitle={rulesSubtitle(current?.name)}
        right={
          canEdit ? (
            <>
              {!validation.ok ? (
                <span className="text-11h font-semibold text-destructive">
                  빨간 표시 항목을 확인해 주세요
                </span>
              ) : dirty ? (
                <span className="text-11h font-semibold text-warning-700">
                  저장하지 않은 변경이 있어요
                </span>
              ) : null}
              <Button
                loading={busy}
                disabled={busy || !validation.ok || !dirty}
                onClick={requestSave}
              >
                <Save />
                규칙 저장
              </Button>
            </>
          ) : (
            <span className="text-11h font-semibold text-muted-foreground">
              읽기 전용 — 규칙 편집 권한이 없어요
            </span>
          )
        }
      />

      <RulesSummary draft={draft} ok={validation.ok} issues={validationIssues} />

      {/* 편집 권한이 없으면 에디터를 시각적으로 잠금(입력 차단 + 흐림). 백엔드도 403 강제. */}
      <div
        className={cn(!canEdit && 'pointer-events-none opacity-65 select-none')}
        aria-disabled={!canEdit}
      >
        <RuleSetEditor
          value={draft}
          onChange={setDraft}
          measureTab={measureTab}
          onMeasureTabChange={setMeasureTab}
        />
      </div>

      {/* 저장 확인 모달 — 활성 주기 재산정 영향 고지 후 확정 */}
      <Dialog
        open={confirmSave}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmSave(false);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>평가 규칙을 저장할까요?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-13 leading-relaxed text-muted-foreground">
              {current?.name ? (
                <><strong className="text-foreground">{current.name}</strong> 주기의 규칙이 변경돼요.</>
              ) : (
                '현재 주기의 규칙이 변경돼요.'
              )}
            </p>
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertDescription>활성 주기의 점수·등급·풀·인상률이 다시 산정됩니다.</AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSave(false)}>
              취소
            </Button>
            <Button loading={busy} disabled={busy} onClick={() => void handleSave()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
