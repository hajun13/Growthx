'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { InfoBanner } from '@/components/InfoBanner';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
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
        subtitle="연봉갱신 Index 엑셀을 업로드해 기존 사용자와 미등록 데이터를 구분하고, 매칭된 행을 보상 데이터에 반영합니다."
      />

      <InfoBanner tone="warning">
        이름 기준으로 기존 사용자를 매칭합니다. <strong>미등록</strong> 또는 <strong>동명이인</strong> 행은 미리보기에서 구분되며,
        매칭된 행만 반영됩니다.
      </InfoBanner>

      <CompensationIndexImportSection
        cycleId={current?.id}
        canEdit={canEdit}
        onImported={async () => {}}
      />
    </PageContainer>
  );
}
