// 얇은 라우트 — 화면 구현은 features/admin-settings 슬라이스(새 아키텍처 표준 패턴).
import { SettingsView } from '@/features/admin-settings/ui/SettingsView';


export default function SettingsPage() {
  return <SettingsView />;
}
