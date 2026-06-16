'use client';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  secondary: '#7A37D8',
  primary: '#7a37d8',
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  outlineVariant: '#ccccd4',
  surfaceLow: '#efeff2',
  white: '#ffffff',
} as const;

export interface CycleOption {
  cycleId: string;
  year: number;
  name: string;
}
export interface CycleMultiSelectProps {
  options: CycleOption[]; // closed 사이클만(부모가 필터)
  selected: string[]; // cycleId[]
  onChange: (ids: string[]) => void;
  min?: number; // 기본 1 — 선택 0개 방지
}

// 비교 사이클 다중 선택(토글 칩). 8px rounded. 연도 오름차순.
export function CycleMultiSelect({
  options,
  selected,
  onChange,
  min = 1,
}: CycleMultiSelectProps) {
  const sorted = [...options].sort((a, b) => a.year - b.year);

  function toggle(id: string) {
    const has = selected.includes(id);
    if (has) {
      // min 미만으로 줄어들지 않게 방지.
      if (selected.length <= min) return;
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (sorted.length === 0) {
    return (
      <span style={{ fontSize: 12, color: K.outline }}>
        비교 가능한 사이클이 없어요.
      </span>
    );
  }

  return (
    <div
      role="group"
      aria-label="비교 사이클 선택"
      className="flex flex-wrap items-center gap-1.5"
    >
      {sorted.map((o) => {
        const active = selected.includes(o.cycleId);
        return (
          <button
            key={o.cycleId}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.cycleId)}
            title={o.name}
            className="outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              transition: 'background .12s, border-color .12s, color .12s',
              background: active ? K.secondary : K.white,
              color: active ? '#fff' : K.onSurfaceVariant,
              border: `1px solid ${active ? K.secondary : K.outlineVariant}`,
              boxShadow: active ? '0 2px 6px rgba(122,55,216,0.18)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = K.secondary;
                (e.currentTarget as HTMLElement).style.color = K.secondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = K.outlineVariant;
                (e.currentTarget as HTMLElement).style.color = K.onSurfaceVariant;
              }
            }}
          >
            {o.year}
          </button>
        );
      })}
    </div>
  );
}
