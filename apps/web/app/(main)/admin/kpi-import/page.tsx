// 개인별 KPI 엑셀 일괄 임포트(관리자 전용) 라우트 — 얇은 래퍼.
// 화면·로직은 admin-kpi-import 수직 슬라이스로 이동(features/admin-kpi-import).
import { AdminKpiImportView } from '@/features/admin-kpi-import/ui/AdminKpiImportView';

export const metadata = { title: 'KPI 일괄 등록' };

export default function KpiImportPage() {
  return <AdminKpiImportView />;
}
