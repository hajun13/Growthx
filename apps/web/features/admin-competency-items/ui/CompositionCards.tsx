'use client';

// 문항 구성 점검 + 작업 순서 카드 — 평가표별 카테고리 가중치 합·대상군·카테고리 공백 요약.
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionMetric } from './QuestionForm';
import type { Audience } from '../weights';

interface Props {
  /** 평가표별 카테고리 가중치 합 — 활성 문항이 없는 평가표는 null. */
  weightSums: Record<Audience, number | null>;
  managerCount: number;
  nonManagerCount: number;
  emptyCategoryCount: number;
  inactiveCount: number;
}

export function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="border-b border-border">
      <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
        <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">{title}</CardTitle>
        {action}
      </CardHeader>
    </div>
  );
}

const sumLabel = (sum: number | null) => (sum == null ? '-' : `${sum}%`);
const sumBad = (sum: number | null) => sum != null && sum !== 100;

export function CompositionCards({
  weightSums, managerCount, nonManagerCount, emptyCategoryCount, inactiveCount,
}: Props) {
  const weightBad = sumBad(weightSums.manager) || sumBad(weightSums.non_manager);
  const steps = [
    ['카테고리', emptyCategoryCount > 0 ? `${emptyCategoryCount}개 카테고리에 문항 없음` : '카테고리 구성 완료'],
    ['대상군', managerCount === 0 || nonManagerCount === 0 ? '직책자/비직책자 문항 균형 확인' : '대상군 문항 분리 완료'],
    ['노출', inactiveCount > 0 ? '비활성 문항은 응답 화면에 숨김' : '모든 문항 활성 상태'],
  ];
  return (
    <div className="gx-workbench-grid">
      <Card>
        <CardHead title="문항 구성 점검" />
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <QuestionMetric label="직책자 가중치 합" value={sumLabel(weightSums.manager)} warn={sumBad(weightSums.manager)} />
            <QuestionMetric label="비직책자 가중치 합" value={sumLabel(weightSums.non_manager)} warn={sumBad(weightSums.non_manager)} />
            <QuestionMetric label="직책자 문항" value={`${managerCount}개`} />
            <QuestionMetric label="비직책자 문항" value={`${nonManagerCount}개`} />
          </div>
          {weightBad && (
            <p className="mt-2 text-12 font-semibold text-warning-700">
              평가표별 카테고리 가중치 합이 100%가 아니에요. 아래 카테고리 가중치에서 조정해 주세요.
            </p>
          )}
          <p className="mt-3 text-12 leading-5 text-muted-foreground">
            역량평가는 연봉·등급에 반영되지 않는 참고 데이터입니다. 다만 문항 수와 대상군이 치우치면 평가 이력의 해석 품질이 낮아지므로,
            활성 문항과 카테고리 공백을 먼저 정리하세요.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHead title="작업 순서" />
        <CardContent className="p-4 md:p-5">
          <div className="space-y-2.5">
            {steps.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                <span className="text-12 font-semibold text-foreground">{label}</span>
                <span className="text-right text-12 leading-5 text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
