'use client';

// DeptHeadMidterm 전용 소형 헬퍼 — 리스트 배지 + Evaluation→User 변환. 파일 상한 분리.
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      <Badge variant="success" shape="pill" size="xs">
        <CheckCircle2 aria-hidden className="size-2.5" />승인
      </Badge>
    );
  }
  if (status === 'revision_requested') {
    return (
      <Badge variant="warning" shape="pill" size="xs">
        재조정 요청
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="destructive" shape="pill" size="xs">
        반려
      </Badge>
    );
  }
  if (status === 'self_done') {
    return (
      <Badge variant="info" shape="pill" size="xs">
        <Clock aria-hidden className="size-2.5" />
        {reviewStage && reviewStage > 0 ? `제출 · 확인 ${reviewStage}단계 완료` : '제출'}
      </Badge>
    );
  }
  return (
    <Badge variant="muted" shape="pill" size="xs">
      미제출
    </Badge>
  );
}
