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
  confirm: { label: '확인', cls: 'bg-[#EAF2FE] text-[#0257CE]' },
  done: { label: '완료', cls: 'bg-[#E4FBFB] text-[#0E7E85]' },
  planned: { label: '예정', cls: 'bg-[#F4F5FA] text-[#6B6980]' },
};

export function RecentChangesTable({ rows }: { rows: ChangeRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-[10px] border border-[#E7E9F3] bg-white p-5 shadow-[0_1px_3px_rgba(22,19,38,0.06),0_1px_2px_rgba(22,19,38,0.04)]">
      <h2 className="mb-3 text-[14px] font-semibold text-[#161326]">최근 변경사항</h2>
      <div className="grid grid-cols-[56px_1fr_88px_64px] border-b border-[#E7E9F3] pb-2 text-[11.5px] font-semibold text-[#9B98AC]">
        <span>구분</span>
        <span>변경 내용</span>
        <span>날짜</span>
        <span>상태</span>
      </div>
      <ul className="flex-1 divide-y divide-[#E7E9F3]">
        {rows.map((row) => (
          <li key={`${row.type}-${row.body}`} className="grid grid-cols-[56px_1fr_88px_64px] items-center py-2.5 text-[12.5px]">
            <span className="font-semibold text-[#2D2A3D]">{row.type}</span>
            <span className="min-w-0 truncate pr-2 text-[#2D2A3D]">{row.body}</span>
            <span className="tabular-nums text-[#6B6980]">{row.date}</span>
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
