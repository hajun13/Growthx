'use client';

/**
 * KpiGoalGuidePanel — KPI 작성 화면 상단, 목표 수립을 어려워하는 팀원을 위한 가이드.
 * P6(part-revision-requirements.md §P6): "목표 수립을 어려워하는 팀원용 목표설정 예시/가이드" 노출.
 * 원문(Part/kpi ....md): "KPI 수립·중간점검·최종평가 체계 운영 정착" 예시 + 기대역할 서술을 그대로 인용.
 * AI 활용 목표 추천은 미구현 — 비활성 배지로 갭만 표시(요구사항 §P6 "AI 탑재는 검토 항목").
 * 접기/펼치기는 공용 Collapsible 재사용(신규 컴포넌트 발명 아님).
 */
import { useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { Collapsible } from '@/components/Collapsible';

const EXAMPLE_TITLE = 'KPI 수립·중간점검·최종평가 체계 운영 정착';
const EXAMPLE_ROLE =
  'KPI 수립·중간점검·최종평가 체계가 조직 전반에 안정적으로 정착될 수 있도록 목표 설정부터 성과 점검, 평가 결과 관리까지 전 과정을 체계적으로 운영합니다. ' +
  '평가 기준과 절차의 일관성을 확보하여 공정하고 신뢰할 수 있는 성과관리 문화를 구축하고, 구성원들이 목표 달성 현황을 지속적으로 확인하며 성과를 개선할 수 있도록 지원합니다. ' +
  '또한 KPI 결과가 평가와 보상에 효과적으로 연계될 수 있도록 관리 체계를 고도화하여 성과 중심 조직문화 정착에 기여해 주시기 바랍니다.';

export function KpiGoalGuidePanel() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onToggle={() => setOpen((v) => !v)}
      className="rounded-lg border-border shadow-elev-1"
      headerClassName="bg-card px-5 py-4 hover:bg-accent/40"
      bodyClassName="bg-muted"
      header={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary">
            <Lightbulb size={15} aria-hidden />
          </span>
          <span className="text-[14px] font-bold text-foreground">목표 수립이 어려우신가요?</span>
          <span className="text-[12px] text-muted-foreground">
            KPI 작성 예시와 기대역할 가이드를 확인해 보세요.
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
            <Sparkles size={11} aria-hidden />
            AI 활용 목표 추천 (예정)
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          아래는 KPI 성과관리지표(제목)와 기대역할 서술 예시예요. 우리 팀 상황에 맞게 구체적인 수치·기한으로 바꿔 작성해 보세요.
        </p>
        <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/[0.08] px-2 py-0.5 text-[10.5px] font-bold text-primary">예시</span>
            <span className="text-[13.5px] font-bold text-foreground break-keep">{EXAMPLE_TITLE}</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground break-keep">
            {EXAMPLE_ROLE}
          </p>
        </div>
        <ul className="space-y-1 text-[11.5px] text-muted-foreground">
          <li>· 목표는 &ldquo;무엇을, 언제까지, 얼마나&rdquo;가 드러나도록 구체적으로 적어요.</li>
          <li>· 측정방식은 중간점검·최종평가에서 그대로 근거가 되니 명확한 산정 기준을 함께 적어요.</li>
          <li>· 정성 KPI는 등급(S~D)별 기준을 미리 정해두면 평가 시 등급 선택이 쉬워져요.</li>
        </ul>
      </div>
    </Collapsible>
  );
}
