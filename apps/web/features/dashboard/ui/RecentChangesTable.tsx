'use client';

// 최근 변경사항 — 시안: 구분/변경 내용/날짜/상태 4열 표 + 상태 배지(확인/완료/예정).
export interface ChangeRow {
  type: string;
  body: string;
  date: string;
  /** confirm=확인(파랑) / done=완료(민트) / planned=예정(회색) */
  tone: 'confirm' | 'done' | 'planned';
}

const TONE: Record<ChangeRow['tone'], { label: string; cls: string }> = {
  confirm: { label: '확인', cls: 'bg-info-50 text-primary' },
  done: { label: '완료', cls: 'bg-brand-teal-subtle text-brand-teal-strong' },
  planned: { label: '예정', cls: 'bg-muted text-muted-foreground' },
};

export function RecentChangesTable({ rows }: { rows: ChangeRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-white p-5 shadow-elev-1">
      <h2 className="mb-3 text-[14px] font-semibold text-foreground">최근 변경사항</h2>
      <div className="grid grid-cols-[56px_1fr_88px_64px] border-b border-border pb-2 text-[11.5px] font-semibold text-neutral-500">
        <span>구분</span>
        <span>변경 내용</span>
        <span>날짜</span>
        <span>상태</span>
      </div>
      <ul className="flex-1 divide-y divide-border">
        {rows.map((row) => (
          <li key={`${row.type}-${row.body}`} className="grid grid-cols-[56px_1fr_88px_64px] items-center py-2.5 text-[12.5px]">
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
    </section>
  );
}
