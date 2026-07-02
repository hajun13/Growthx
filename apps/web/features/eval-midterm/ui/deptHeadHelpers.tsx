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

export function ReviewBadge({ status }: { status?: MidtermReview['status'] }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>
        <CheckCircle2 size={10} />승인
      </span>
    );
  }
  if (status === 'self_done') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>
        <Clock size={10} />제출
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 bg-muted text-[10.5px] font-medium text-muted-foreground/60">
      미제출
    </span>
  );
}
