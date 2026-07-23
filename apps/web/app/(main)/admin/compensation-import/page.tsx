// 연봉갱신 Index 엑셀 일괄 임포트(관리자 전용) 라우트 — KPI 일괄 등록과 동일한 얇은 래퍼.
import { CompensationIndexImportView } from '@/features/admin-compensation/ui/CompensationIndexImportView';

export const metadata = { title: '연봉 일괄 등록' };

export default function CompensationImportPage() {
  return <CompensationIndexImportView />;
}
