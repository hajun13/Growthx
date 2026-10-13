'use client';

// 권한 매트릭스·사이드바 메뉴 탭 — 상태는 PermissionsView 가 소유, 여기는 표시·토글 위임만.
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { InfoBanner } from '@/components/InfoBanner';
import { LEVEL_DEFS, type FeatureKey, type MatrixConfig, type NavConfig, type PermLevel } from '@/lib/permConfig';
import type { NavItem } from '@/lib/nav';
import {
  LevelBadge,
  PermissionBulkButton,
  PermissionStateButton,
  PermissionTabShell,
  type SidebarPermissionRow,
} from './PermissionsParts';

type LevelDef = (typeof LEVEL_DEFS)[number];

// 권한 매트릭스 열
const matrixCols: FeatureKey[] = [
  '평가결과 전체열람',
  'KPI 승인/반려',
  '등급풀 수정',
  '권한 부여·수정',
  '시스템 설정',
  '감사로그',
];

// 매트릭스·사이드바 표는 가로 스크롤(min-w) — 첫 열(권한 레벨/메뉴)을 고정해 기준을 잃지 않게 한다.
// DataTableColumn.className 은 th/td 양쪽에 적용: td 는 z-1+bg-card, th 는 변형 셀렉터로 z/배경을 헤더 톤으로 유지.
const stickyFirstColCls = 'sticky left-0 z-1 bg-card [&:is(th)]:z-20 [&:is(th)]:bg-muted';

const readOnlyNotice = "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다.";


export function MatrixTab({
  matrixConfig,
  canEdit,
  onToggle,
}: {
  matrixConfig: MatrixConfig;
  canEdit: boolean;
  onToggle: (level: PermLevel, feature: FeatureKey) => void;
}) {
  const columns: DataTableColumn<LevelDef>[] = [
    {
      key: 'level',
      header: '권한 레벨',
      width: '240px',
      className: stickyFirstColCls,
      render: (cfg) => (
        <div className="min-w-0">
          <LevelBadge level={cfg.key} />
          <div className="mt-1 text-11 leading-relaxed text-muted-foreground">{cfg.desc}</div>
        </div>
      ),
    },
    ...matrixCols.map((col): DataTableColumn<LevelDef> => ({
      key: col,
      header: col,
      align: 'center',
      width: '132px',
      render: (cfg) => (
        <PermissionStateButton
          checked={matrixConfig[cfg.key][col]}
          onClick={() => onToggle(cfg.key, col)}
          disabled={!canEdit}
        />
      ),
    })),
  ];

  return (
    <PermissionTabShell
      notice={(
        <InfoBanner tone={canEdit ? 'info' : 'tip'}>
          {canEdit
            ? "셀에서 허용/차단을 전환한 뒤 '권한 저장'을 눌러야 적용돼요 — 저장 전에는 반영되지 않아요."
            : readOnlyNotice}
        </InfoBanner>
      )}
    >
      <div className="gx-panel overflow-hidden">
        <DataTable
          columns={columns}
          rows={LEVEL_DEFS}
          rowKey={(row) => row.key}
          stickyHeader
          emphasizeHeader
          className="min-w-280"
          // eslint-disable-next-line shadcn/require-static-classes -- DataTable.rowClassName(공개 API)은 행 데이터별 조건 클래스를 반환하는 함수라 정적 분석 불가
          rowClassName={(row) => (row.key === 'hr' ? 'bg-muted/40' : undefined)}
        />
      </div>
    </PermissionTabShell>
  );
}

export function SidebarTab({
  rows,
  navVisibility,
  canEdit,
  onToggleNav,
  isLevelAllSelected,
  onToggleLevelAll,
  isCatAllSelected,
  onToggleCatLevel,
}: {
  rows: SidebarPermissionRow[];
  navVisibility: NavConfig;
  canEdit: boolean;
  onToggleNav: (level: PermLevel, key: string) => void;
  isLevelAllSelected: (level: PermLevel) => boolean;
  onToggleLevelAll: (level: PermLevel) => void;
  isCatAllSelected: (level: PermLevel, items: NavItem[]) => boolean;
  onToggleCatLevel: (level: PermLevel, items: NavItem[]) => void;
}) {
  const columns: DataTableColumn<SidebarPermissionRow>[] = [
    {
      key: 'menu',
      header: '메뉴',
      width: '280px',
      className: stickyFirstColCls,
      render: (row) => (
        row.kind === 'section' ? (
          <div className="flex items-center gap-2">
            <span className="text-12 font-bold text-foreground">{row.label}</span>
            <span className="text-10h font-semibold text-muted-foreground">{row.count}</span>
          </div>
        ) : (
          <span className={`block truncate text-13 font-medium text-foreground ${row.grouped ? 'pl-4' : ''}`}>
            {row.label}
          </span>
        )
      ),
    },
    ...LEVEL_DEFS.map((def): DataTableColumn<SidebarPermissionRow> => ({
      key: def.key,
      header: (
        <div className="flex flex-col items-center gap-1">
          <span className="whitespace-nowrap text-11h">{def.label}</span>
          <PermissionBulkButton
            active={isLevelAllSelected(def.key)}
            onClick={() => onToggleLevelAll(def.key)}
            disabled={!canEdit}
          />
        </div>
      ),
      align: 'center',
      width: '156px',
      render: (row) => {
        if (row.kind === 'section') {
          return (
            <PermissionBulkButton
              active={isCatAllSelected(def.key, row.items)}
              onClick={() => onToggleCatLevel(def.key, row.items)}
              disabled={!canEdit}
            />
          );
        }
        return (
          <PermissionStateButton
            checked={navVisibility[def.key]?.[row.item.key] !== false}
            checkedLabel="표시"
            uncheckedLabel="숨김"
            onClick={() => onToggleNav(def.key, row.item.key)}
            disabled={!canEdit}
          />
        );
      },
    })),
  ];

  return (
    <PermissionTabShell
      notice={(
        <InfoBanner tone={canEdit ? 'info' : 'tip'}>
          {canEdit
            ? "레벨 전체 또는 카테고리 단위로 메뉴 노출을 조정한 뒤 '권한 저장'을 눌러야 적용돼요."
            : readOnlyNotice}
        </InfoBanner>
      )}
    >
      <div className="gx-panel overflow-hidden">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          stickyHeader
          emphasizeHeader
          className="min-w-265"
          // eslint-disable-next-line shadcn/require-static-classes -- DataTable.rowClassName(공개 API)은 행 데이터별 조건 클래스를 반환하는 함수라 정적 분석 불가
          rowClassName={(row) => (row.kind === 'section' ? 'bg-accent/45 hover:bg-accent/45' : undefined)}
        />
      </div>
    </PermissionTabShell>
  );
}
