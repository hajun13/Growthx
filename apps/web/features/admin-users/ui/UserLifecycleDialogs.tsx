'use client';

/**
 * UserLifecycleDialogs — 퇴사·복직·삭제·완전삭제 확인 다이얼로그 4종 (상태는 AdminUsersView 가 소유).
 */

import { Input } from '@/components/ui/input';
import { LifecycleConfirmModal } from './LifecycleConfirmModal';

interface Target {
  user: { name: string };
  group: string;
  division: string;
  team: string;
  positionLabel: string;
}

interface Props<R extends Target> {
  resignTarget: R | null; setResignTarget: (r: R | null) => void;
  reactivateTarget: R | null; setReactivateTarget: (r: R | null) => void;
  deleteTarget: R | null; setDeleteTarget: (r: R | null) => void;
  deleteBlocked: string | null; setDeleteBlocked: (m: string | null) => void;
  purgeTarget: R | null; setPurgeTarget: (r: R | null) => void;
  purgeConfirm: string; setPurgeConfirm: (v: string) => void;
  busy: boolean;
  onResign: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onEscalateToPurge: () => void;
  onPurge: () => void;
}

export function UserLifecycleDialogs<R extends Target>({
  resignTarget, setResignTarget, reactivateTarget, setReactivateTarget,
  deleteTarget, setDeleteTarget, deleteBlocked, setDeleteBlocked,
  purgeTarget, setPurgeTarget, purgeConfirm, setPurgeConfirm,
  busy, onResign, onReactivate, onDelete, onEscalateToPurge, onPurge,
}: Props<R>) {
  return (
    <>
      {/* 퇴사 확인 */}
      {resignTarget && (
        <LifecycleConfirmModal title="퇴사 처리할까요?" onCancel={() => setResignTarget(null)} confirmLabel="퇴사 처리" confirmVariant="danger" busy={busy} onConfirm={onResign}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{resignTarget.user.name}</strong> ({resignTarget.team || resignTarget.division || resignTarget.group || '소속 미지정'} · {resignTarget.positionLabel})을(를) 퇴사 처리합니다.<br />비활성으로 전환되어 로그인할 수 없게 되고, 평가 이력은 보존됩니다.</p>
        </LifecycleConfirmModal>
      )}

      {/* 복직 확인 */}
      {reactivateTarget && (
        <LifecycleConfirmModal title="복직 처리할까요?" onCancel={() => setReactivateTarget(null)} confirmLabel="복직 처리" confirmVariant="primary" busy={busy} onConfirm={onReactivate}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{reactivateTarget.user.name}</strong>님을 다시 활성 상태로 전환합니다. 재직 상태가 '재직'으로 바뀌고 로그인할 수 있어요.</p>
        </LifecycleConfirmModal>
      )}

      {/* 삭제 확인 */}
      {deleteTarget && (
        <LifecycleConfirmModal title="사용자를 삭제할까요?" onCancel={() => { setDeleteTarget(null); setDeleteBlocked(null); }} confirmLabel={deleteBlocked ? '완전 삭제로 전환' : '삭제'} confirmVariant="danger" busy={busy} onConfirm={deleteBlocked ? onEscalateToPurge : onDelete}>
          <p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">{deleteTarget.user.name}</strong> ({deleteTarget.positionLabel}) 계정을 삭제합니다. 평가 이력이 없으면 바로 삭제돼요.</p>
          {deleteBlocked && (
            <div className="mt-3 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-12h text-foreground leading-relaxed">
              {deleteBlocked}<br /><span className="font-semibold text-danger-600">이력까지 지우려면 '완전 삭제로 전환'을 누르세요.</span>
            </div>
          )}
        </LifecycleConfirmModal>
      )}

      {/* 완전 삭제 확인 */}
      {purgeTarget && (
        <LifecycleConfirmModal title="이력까지 완전 삭제할까요?" onCancel={() => { setPurgeTarget(null); setPurgeConfirm(''); }} confirmLabel="완전 삭제" confirmVariant="danger" busy={busy} disabled={purgeConfirm.trim() !== purgeTarget.user.name} onConfirm={onPurge}>
          <div className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-12h text-foreground leading-relaxed">
            <strong className="text-danger-600">되돌릴 수 없는 작업이에요.</strong> <strong>{purgeTarget.user.name}</strong>님의 평가 이력(결과·KPI·보상 등)이 함께 영구 삭제됩니다.
          </div>
          <div className="mt-4">
            <label className="block mb-1.5 text-xs font-semibold text-muted-foreground">확인을 위해 이름 <span className="text-danger-600">"{purgeTarget.user.name}"</span>을(를) 입력하세요.</label>
            <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder={purgeTarget.user.name} autoFocus />
          </div>
        </LifecycleConfirmModal>
      )}
    </>
  );
}
