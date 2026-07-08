'use client';

// 최근 알림 — 구분/내용/날짜/상태 4열 표 + 상태 배지(확인 필요/확인함).
// 데이터는 합성 문구가 아니라 실제 알림(useNotifications) 최신 항목에서 파생한다.
export interface ChangeRow {
  key: string;
  type: string;
  body: string;
  date: string;
  /** confirm=확인 필요(파랑, 안읽음) / done=확인함(민트, 읽음) */
  tone: 'confirm' | 'done';
}

const TONE: Record<ChangeRow['tone'], { label: string; cls: string }> = {
  confirm: { label: '확인 필요', cls: 'bg-info-50 text-primary' },
  done: { label: '확인함', cls: 'bg-brand-teal-subtle text-brand-teal-strong' },
};

export function RecentChangesTable({ rows }: { rows: ChangeRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-elev-1">
      <h2 className="mb-3 text-[14px] font-semibold text-foreground">최근 알림</h2>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-[13px] text-neutral-500">
          아직 받은 알림이 없어요.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[56px_1fr_88px_72px] border-b border-border pb-2 text-[11.5px] font-semibold text-neutral-500">
            <span>구분</span>
            <span>내용</span>
            <span>날짜</span>
            <span>상태</span>
          </div>
          <ul className="flex-1 divide-y divide-border">
            {rows.map((row) => (
              <li key={row.key} className="grid grid-cols-[56px_1fr_88px_72px] items-center py-2.5 text-[12.5px]">
                <span className="font-semibold text-neutral-800">{row.type}</span>
                <span className="min-w-0 truncate pr-2 text-neutral-800">{row.body}</span>
                <span className="tabular-nums text-muted-foreground">{row.date}</span>
                <span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[row.tone].cls}`}>
                    {TONE[row.tone].label}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
