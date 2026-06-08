'use client';

// 임시 프리뷰(디자인 확인용) — 검증 후 삭제.
import { EvalReport } from '@/components/EvalReport';

export default function PreviewEvalReport() {
  return (
    <EvalReport
      onClose={() => {}}
      data={{
        name: '김성장',
        dept: '에너지엑스 그룹 · 영업본부 · 1팀',
        title: '책임',
        cycleName: '2026 정기평가',
        finalGrade: 'A',
        finalScore: 88.4,
        percentile: 12.5,
        companyAvg: 81.2,
        byGroup: {
          performance_core: { score: 90.1, grade: 'A' },
          collaboration_growth: { score: 82.0, grade: 'B' },
        },
        byType: {
          source: 'live',
          self: { score: 92, grade: 'S', comment: '목표 매출 120% 달성, 신규 수주 3건.' },
          downward1: { score: 89, grade: 'A', comment: '핵심 프로젝트를 안정적으로 리드했고 협업 기여가 큼.' },
          downward2: { score: 87, grade: 'A', comment: '본부 목표 달성에 실질적으로 기여. 일부 일정 관리 보완 필요.' },
          downward3: { score: 88, grade: 'A', comment: '전사 기준에서도 우수. 차년도 리더 후보로 추천.' },
          compScore: 84.5,
          perfSum: 88.4,
          stageMode: 'exception2',
        },
      }}
    />
  );
}
