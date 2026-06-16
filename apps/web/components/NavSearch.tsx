'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CornerDownLeft,
  FileText,
  User as UserIcon,
  Network,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { searchAll } from '@/hooks/useSearch';
import { positionLabel, employmentStatusLabel } from '@/lib/ui';
import type { SearchResults } from '@/lib/types';
import type { NavItem } from '@/lib/nav';

type Section = '메뉴' | '사용자' | '부서';

interface Entry {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  section: Section;
  href: string;
}

const SECTION_ICON: Record<Section, typeof FileText> = {
  메뉴: FileText,
  사용자: UserIcon,
  부서: Network,
};

const DEPT_TYPE_LABEL: Record<string, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

const EMPTY: SearchResults = { users: [], departments: [] };

// 상단바 검색 — 메뉴(화면) 이동 + 사용자·부서 전역 검색 명령 팔레트.
// items 는 AppShell 에서 이미 권한 필터링된 가시 메뉴 목록.
export function NavSearch({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [server, setServer] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 최신 요청만 반영(stale 응답 무시)용 토큰.
  const reqRef = useRef(0);

  // Ctrl/Cmd + K 로 열기(플랫폼 공용).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 열릴 때 초기화 + 포커스.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setServer(EMPTY);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // 서버 검색 — 입력 디바운스(200ms). 2글자 이상부터 호출.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setServer(EMPTY);
      setLoading(false);
      return;
    }
    const token = ++reqRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchAll(term)
        .then((res) => {
          if (reqRef.current === token) setServer(res);
        })
        .catch(() => {
          if (reqRef.current === token) setServer(EMPTY);
        })
        .finally(() => {
          if (reqRef.current === token) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // 메뉴 매칭(클라이언트).
  const menuEntries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? items
      : items.filter((it) =>
          `${it.label} ${it.group ?? ''}`.toLowerCase().includes(q),
        );
    return matched.map((it) => ({
      id: `menu:${it.key}`,
      label: it.label,
      sublabel: it.group,
      section: '메뉴' as const,
      href: it.href,
    }));
  }, [items, query]);

  // 서버 결과 → 엔트리.
  const userEntries = useMemo<Entry[]>(
    () =>
      server.users.map((u) => ({
        id: `user:${u.id}`,
        label: u.name,
        sublabel: [positionLabel[u.position] ?? u.position, u.departmentName]
          .filter(Boolean)
          .join(' · '),
        badge:
          u.employmentStatus !== 'active'
            ? employmentStatusLabel[u.employmentStatus]
            : undefined,
        section: '사용자' as const,
        href: `/eval/result/${u.id}`,
      })),
    [server.users],
  );

  const deptEntries = useMemo<Entry[]>(
    () =>
      server.departments.map((d) => ({
        id: `dept:${d.id}`,
        label: d.name,
        sublabel: [DEPT_TYPE_LABEL[d.type] ?? d.type, d.parentName]
          .filter(Boolean)
          .join(' · '),
        section: '부서' as const,
        href: '/org',
      })),
    [server.departments],
  );

  // 키보드 네비게이션용 평탄 리스트(메뉴 → 사용자 → 부서).
  const entries = useMemo(
    () => [...menuEntries, ...userEntries, ...deptEntries],
    [menuEntries, userEntries, deptEntries],
  );

  // 결과가 줄면 active 보정.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, entries.length - 1)));
  }, [entries.length]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(entries[active]);
    }
  };

  // 섹션별 렌더(평탄 인덱스 유지).
  const sections: Section[] = ['메뉴', '사용자', '부서'];
  let flatIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 border border-border bg-neutral-100 px-3 transition-colors hover:bg-neutral-200 sm:flex rounded-pill"
        style={{ height: 32, minWidth: 172 }}
        aria-label="검색"
      >
        <Search size={12} color="#A0A0AC" />
        <span className="flex-1 text-left text-[12px] text-neutral-400">
          메뉴·사람 검색
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-none">
          <DialogTitle className="sr-only">검색</DialogTitle>
          <DialogDescription className="sr-only">
            메뉴·사용자·부서를 검색해 이동하세요.
          </DialogDescription>

          {/* 입력 */}
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search size={15} color="#74747f" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="메뉴·이름·부서로 검색…"
              className="flex-1 bg-transparent py-3.5 text-[14px] text-foreground outline-none placeholder:text-neutral-400"
            />
            {loading && (
              <Loader2
                size={15}
                className="animate-spin text-neutral-400"
                aria-label="검색 중"
              />
            )}
          </div>

          {/* 결과 */}
          <div className="max-h-[360px] overflow-y-auto py-1.5">
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-neutral-400">
                {query.trim().length >= 2 && !loading
                  ? '검색 결과가 없습니다.'
                  : '메뉴 이름, 직원 이름, 부서명으로 검색하세요.'}
              </p>
            ) : (
              sections.map((section) => {
                const secEntries = entries.filter((e) => e.section === section);
                if (secEntries.length === 0) return null;
                const SecIcon = SECTION_ICON[section];
                return (
                  <div key={section} className="pb-1">
                    <div className="flex items-center gap-1.5 px-4 pb-0.5 pt-2">
                      <SecIcon size={11} color="#a0a0ac" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-neutral-400">
                        {section}
                      </span>
                    </div>
                    {secEntries.map((entry) => {
                      flatIndex += 1;
                      const i = flatIndex;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(entry)}
                          className={
                            'flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors ' +
                            (i === active
                              ? 'bg-neutral-100'
                              : 'hover:bg-neutral-50')
                          }
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {entry.label}
                            </span>
                            {entry.sublabel && (
                              <span className="truncate text-[11px] text-neutral-400">
                                {entry.sublabel}
                              </span>
                            )}
                            {entry.badge && (
                              <span className="shrink-0 bg-neutral-200 px-1 text-[10px] text-neutral-600">
                                {entry.badge}
                              </span>
                            )}
                          </span>
                          {i === active && (
                            <CornerDownLeft
                              size={13}
                              color="#74747f"
                              className="shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
