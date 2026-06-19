'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { InfoBanner } from '@/components/InfoBanner';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { CompensationIndexImportSection } from './CompensationIndexImportSection';

export function CompensationIndexImportView() {
  const { user } = useAuth();
  const { current, loading } = useCurrentCycle();
  const canEdit = !!user && isHrAdmin(user.role);

  if (!canEdit) return <Forbidden message="연봉 일괄 등록은 전체 관리자만 사용할 수 있어요." />;
  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <PageContainer>
      <PageHeader
        title="연봉 일괄 등록"
        subtitle="연봉갱신 Index 엑셀을 미리보기로 검토한 뒤 매칭된 행만 보상 데이터에 반영합니다."
        right={
          <HeaderMetrics
            items={[
              { label: '평가 주기', value: current?.name ?? '없음' },
              { label: '권한', value: 'HR 관리자', accent: 'text-primary' },
            ]}
          />
        }
      />

      <InfoBanner tone="info" title="업로드 전 확인">
        이름 기준으로 기존 사용자를 매칭합니다. 미등록 또는 동명이인 행은 결과 표에서 구분되며, 매칭 행만 반영됩니다.
      </InfoBanner>

      <CompensationIndexImportSection
        cycleId={current?.id}
        canEdit={canEdit}
        onImported={async () => {}}
      />
    </PageContainer>
  );
}
