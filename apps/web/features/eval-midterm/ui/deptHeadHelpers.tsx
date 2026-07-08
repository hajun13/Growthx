'use client';

// DeptHeadMidterm 전용 소형 헬퍼 — 리스트 배지 + Evaluation→User 변환. 파일 상한 분리.
import { CheckCircle2, Clock } from 'lucide-react';
import type { User, Evaluation, MidtermReview } from '@/lib/types';

// downward 대상 Evaluation → UserCombobox 후보 최소 User shape.
export function targetsToUsers(targets: Evaluation[]): User[] {
  return targets.map((t) => ({
    id: t.evaluateeId,
    name: t.userName ?? t.evaluateeId.slice(0, 8),
    email: '',
    role: 'employee',
    position: '',
    departmentId: null,
    managerId: null,
    jobLevel: 'senior_minus',
    mustChangePassword: false,
    visibilityScope: 'self',
    isActive: true,
    employmentStatus: 'active',
    legalEntity: 'energyx',
    resignedAt: null,
    evaluationExempt: false,
    evaluationExemptReason: null,
    createdAt: '',
  })) as User[];
}

// 목록 상태 배지 — 반송(재조정 요청·반려)을 '미제출'로 뭉개지 않고 구분, self_done 은 확인 단계까지 표기.
// 칩 색은 MemberDetail 헤더 배지와 동일 팔레트.
export function ReviewBadge({
  status,
  reviewStage,
}: {
  status?: MidtermReview['status'];
  reviewStage?: number;
}) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>
        <CheckCircle2 size={10} />승인
      </span>
    );
  }
  if (status === 'revision_requested') {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#FFEEDD', color: '#C2570A' }}>
        재조정 요청
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#FDE8E8', color: '#C81E1E' }}>
        반려
      </span>
    );
  }
  if (status === 'self_done') {
    return (
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>
        <Clock size={10} />
        {reviewStage && reviewStage > 0 ? `제출 · 확인 ${reviewStage}단계 완료` : '제출'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 bg-muted text-[10.5px] font-medium text-muted-foreground/60">
      미제출
    </span>
  );
}
