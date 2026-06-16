'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Forbidden } from '@/components/States';
import {
  LegalEntityFilter,
  type LegalEntityValue,
} from '@/components/yoy/LegalEntityFilter';
import { ResignedToggle } from '@/components/yoy/ResignedToggle';
import { canReview } from '@/lib/nav';
import { PersonTimelinePanel } from './PersonTimelinePanel';
import { OrgDistributionPanel } from './OrgDistributionPanel';

type YoyTab = 'person' | 'org';

export function YoyCompareView() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const tabParam = search.get('tab');
  const tab: YoyTab = tabParam === 'org' ? 'org' : 'person';

  // 두 탭이 공유하는 페이지 레벨 상태(법인필터·퇴사자 토글).
  const [legalEntity, setLegalEntity] = useState<LegalEntityValue>('all');
  // 조직 분포는 당시 인원 기준이 맞으므로 기본 ON(컴포넌트 스펙 §3.2).
  const [includeResigned, setIncludeResigned] = useState(true);

  // 쿼리스트링 동기화 헬퍼 — 기존 파라미터 유지하며 일부만 갱신.
  const pushQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [search, pathname, router],
  );

  const setTab = useCallback(
    (key: string) => pushQuery({ tab: key }),
    [pushQuery],
  );

  const allowed = !!user && canReview(user.role);

  const tabItems = useMemo(
    () =>
      [
        ['person', '개인 타임라인'],
        ['org', '조직 등급분포'],
      ] as const,
    [],
  );

  if (!allowed) {
    return <Forbidden message="연도 비교는 팀장 이상만 볼 수 있어요." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="연도 비교"
        subtitle="연도를 누적해 추이·분포를 비교해요."
        right={
          <div className="flex flex-wrap items-center gap-3">
            <LegalEntityFilter value={legalEntity} onChange={setLegalEntity} />
            {/* 퇴사자 토글은 개인 타임라인에만 의미가 있다(분포는 당시 재직 인원 기준 고정).
                #7-b: 분포 탭에서는 토글을 숨기고 고정 안내만 노출. */}
            {tab === 'person' ? (
              <ResignedToggle
                checked={includeResigned}
                onChange={setIncludeResigned}
              />
            ) : (
              <span style={{ fontSize: 11, color: '#74747f' }}>
                분포는 당시 재직 인원 기준이에요
              </span>
            )}
          </div>
        }
      />

      {/* 탭 — Kinetic rounded 세그먼트 */}
      <div
        role="tablist"
        aria-label="연도 비교 보기"
        className="flex w-full items-center gap-1 overflow-x-auto p-1 rounded-xl sm:w-fit"
        style={{ background: '#efeff2' }}
      >
        {tabItems.map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className="px-4 py-2 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                fontSize: 13,
                fontWeight: 600,
                background: active ? '#fff' : 'transparent',
                color: active ? '#18181c' : '#565660',
                boxShadow: active ? '0 4px 12px rgba(86,69,153,0.05)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'person' ? (
        <PersonTimelinePanel
          legalEntity={legalEntity}
          includeResigned={includeResigned}
          search={search}
          pushQuery={pushQuery}
        />
      ) : (
        <OrgDistributionPanel
          legalEntity={legalEntity}
          includeResigned={includeResigned}
          search={search}
          pushQuery={pushQuery}
        />
      )}
    </PageContainer>
  );
}
