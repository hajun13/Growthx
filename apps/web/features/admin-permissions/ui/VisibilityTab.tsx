'use client';

// 가시성 설정(정책 시안) 탭 — 저장 미연동, 읽기 전용.
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { InfoBanner } from '@/components/InfoBanner';
import {
  PermissionStateButton,
  PermissionTabShell,
  ScopeBadge,
  initialVisRules,
  sensitiveFields,
  type VisRule,
  type VisScope,
} from './PermissionsParts';

const scopeDesc: Record<VisScope, string> = {
  전체: '전 조직',
  그룹: '소속 그룹',
  본부: '소속 본부',
  팀: '소속 팀',
  본인: '타인 열람 없음',
};

const columns: DataTableColumn<VisRule>[] = [
  {
    key: 'role',
    header: '직급/직책',
    width: '240px',
    render: (rule) => (
      <div>
        <div className="text-13 font-semibold text-foreground">{rule.title}</div>
        <div className="mt-0.5 text-11 leading-relaxed text-muted-foreground">{rule.note}</div>
      </div>
    ),
  },
  {
    key: 'scope',
    header: '범위',
    align: 'center',
    width: '96px',
    render: (rule) => <ScopeBadge scope={rule.scope} />,
  },
  ...sensitiveFields.map((field): DataTableColumn<VisRule> => ({
    key: field,
    header: field,
    align: 'center',
    width: '128px',
    render: (rule) => {
      if (rule.scope === '본인') {
        return <span className="text-13 font-semibold text-muted-foreground/60">-</span>;
      }
      // 정책 시안(저장 미연동) — 토글 비활성. 실제 가시성 제어는 백엔드 visibilityScope 가 담당.
      return (
        <PermissionStateButton
          checked={!!rule.sensitive[field]}
          checkedLabel={rule.role === 'hr-admin' ? '고정' : '허용'}
          uncheckedLabel="차단"
          disabled
        />
      );
    },
  })),
];

export function VisibilityTab() {
  // 가시성 설정은 정책 시안(저장 미연동) — 토글을 열어두면 "설정했는데 안 먹는" 오해를 낳아 읽기 전용 고정.
  return (
    <PermissionTabShell
      notice={(
        <InfoBanner tone="tip" title="정책 시안 — 저장 연동 전">
          이 탭은 열람 범위 정책의 시안이라 토글이 비활성화되어 있어요. 실제 열람 범위는
          '사용자별 권한' 탭의 권한 레벨(가시 범위)이 결정합니다.
        </InfoBanner>
      )}
    >
      <div className="gx-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="gx-quiet-section-title">열람 범위</h2>
          <p className="mt-1 text-12 leading-relaxed text-muted-foreground">
            본인을 제외한 타인의 데이터를 어디까지 볼 수 있는지 정의합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-0 md:grid-cols-3 xl:grid-cols-5">
          {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((scope) => (
            <div key={scope} className="min-h-24.5 border-r border-border px-5 py-4 last:border-r-0">
              <ScopeBadge scope={scope} />
              <p className="mt-2 text-13 font-semibold text-foreground">{scopeDesc[scope]}</p>
              <p className="mt-1 text-11 text-muted-foreground">본인 데이터는 항상 열람</p>
            </div>
          ))}
        </div>
      </div>

      <InfoBanner tone="warning">
        <strong className="text-foreground">경쟁 구조 보호</strong> — 본부/팀 간 데이터는 상호 비공개이며,
        민감정보는 권한 범위 안에서만 표시됩니다.
      </InfoBanner>

      <div className="gx-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="gx-quiet-section-title">타인 민감정보 열람 권한</h2>
          <p className="mt-1 text-12 leading-relaxed text-muted-foreground">
            정책 시안(읽기 전용) — 저장 연동 전이라 토글을 조작할 수 없어요.
          </p>
        </div>
        <DataTable
          columns={columns}
          rows={initialVisRules}
          rowKey={(row) => row.role}
          stickyHeader
          emphasizeHeader
          className="min-w-230"
// eslint-disable-next-line shadcn/require-static-classes -- DataTable.rowClassName(공개 API)은 행 데이터별 조건 클래스를 반환하는 함수라 정적 분석 불가
          rowClassName={(row) => (row.role === 'hr-admin' ? 'bg-muted/40' : undefined)}
        />
      </div>
    </PermissionTabShell>
  );
}
