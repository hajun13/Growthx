'use client';

// 검색형 사용자 선택 콤보박스 — KPI 일괄 등록의 파일별 대상자 매칭용.
// 활성 사용자 목록(useUsers)을 부모에서 받아 이름/이메일/직급으로 즉석 필터링한다.
// 외부 의존(Radix Select 등) 없이 가볍게 구현 — 행이 많은 표 안에서 다수 인스턴스로 쓰임.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { T } from '@/lib/toss';
import type { User } from '@/lib/types';

export interface UserComboboxProps {
  users: User[];
  value: string | null; // 선택된 userId
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  // 파일명 추정으로 제안된 후보(있으면 옵션 상단 강조). 확정은 아님.
  suggestedId?: string | null;
}

export function UserCombobox({
  users,
  value,
  onChange,
  placeholder = '대상자 선택',
  disabled,
  suggestedId,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value],
  );

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.position ?? '').toLowerCase().includes(q),
        )
      : users;
    // 제안 후보를 목록 맨 위로.
    if (suggestedId) {
      const idx = base.findIndex((u) => u.id === suggestedId);
      if (idx > 0) {
        const copy = [...base];
        const [s] = copy.splice(idx, 1);
        copy.unshift(s);
        return copy.slice(0, 50);
      }
    }
    return base.slice(0, 50);
  }, [users, query, suggestedId]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 200 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          border: `1px solid ${value ? T.blue500 : T.grey300}`,
          background: disabled ? T.grey50 : '#fff',
          padding: '7px 10px',
          fontSize: 12.5,
          color: selected ? T.grey900 : T.grey500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? (
            <>
              {selected.name}
              <span style={{ color: T.grey500, marginLeft: 6, fontSize: 11.5 }}>
                {selected.position}
              </span>
            </>
          ) : (
            placeholder
          )}
        </span>
        {selected && !disabled && (
          <X
            size={13}
            color={T.grey400}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            aria-label="선택 해제"
          />
        )}
        <ChevronDown size={13} color={T.grey400} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: '#fff',
            border: `1px solid ${T.grey200}`,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            minWidth: 240,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${T.grey100}` }}>
            <Search size={13} color={T.grey400} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·이메일·직급 검색"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12.5, color: T.grey900 }}
            />
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: 12, color: T.grey500, textAlign: 'center' }}>
                일치하는 사용자가 없어요.
              </div>
            ) : (
              filtered.map((u) => {
                const isSel = u.id === value;
                const isSuggest = u.id === suggestedId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: isSel ? '#f0f6ff' : '#fff',
                      border: 'none',
                      borderBottom: `1px solid ${T.grey50}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 14, display: 'inline-flex' }}>
                      {isSel && <Check size={13} color={T.blue500} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, color: T.grey900 }}>{u.name}</span>
                      <span style={{ fontSize: 11, color: T.grey500, marginLeft: 6 }}>{u.position}</span>
                      <div style={{ fontSize: 11, color: T.grey500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </span>
                    {isSuggest && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: T.blue600, background: '#eaf2ff', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                        추천
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
