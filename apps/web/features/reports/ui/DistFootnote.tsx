'use client';

// 하단 안내문 — image 14: 점수 산정·등급 기준·반영 방식·참고사항.
import { Info } from 'lucide-react';

export function DistFootnote() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
        <Info size={14} className="text-primary" aria-hidden />
        안내
      </div>
      <ul className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
        <li>최종점수는 실적(60%) + 역량(40%, 참고용) 가중합산 점수입니다.</li>
        <li>등급 기준: S(95점 이상), A(85점 이상 95점 미만), B(70점 이상 85점 미만), C(60점 이상 70점 미만), D(60점 미만) — 실제 등급 풀 기준은 그룹 단위로 산정돼요.</li>
        <li>전사 평균은 반올림되어 표시되며, 실제 계산과 차이가 있을 수 있습니다.</li>
      </ul>
    </div>
  );
}
