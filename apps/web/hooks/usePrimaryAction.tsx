'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface PrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface PrimaryActionContextValue {
  action: PrimaryAction | null;
  setAction: (a: PrimaryAction | null) => void;
}

const PrimaryActionContext = createContext<PrimaryActionContextValue | null>(
  null,
);

export function PrimaryActionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [action, setAction] = useState<PrimaryAction | null>(null);
  return (
    <PrimaryActionContext.Provider value={{ action, setAction }}>
      {children}
    </PrimaryActionContext.Provider>
  );
}

// 레이아웃이 현재 등록된 액션을 읽는다.
export function usePrimaryActionSlot(): PrimaryAction | null {
  const ctx = useContext(PrimaryActionContext);
  return ctx?.action ?? null;
}

// 페이지가 우하단 고정 액션을 등록한다(언마운트 시 해제).
export function useSetPrimaryAction(
  action: PrimaryAction | null,
  deps: unknown[],
): void {
  const ctx = useContext(PrimaryActionContext);
  useEffect(() => {
    ctx?.setAction(action);
    return () => ctx?.setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
