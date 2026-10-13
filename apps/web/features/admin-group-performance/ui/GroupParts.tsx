'use client';

// 등급풀 관리 화면의 작은 표시 조각 — 섹션 카드(헤더+본문), 집계 항목, 상태 노트, 작업 단계.
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SectionCard({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">{title}</CardTitle>
          {action}
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">{children}</CardContent>
    </Card>
  );
}

export function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3">
      <dt className="text-11 text-muted-foreground">{label}</dt>
      <dd className="text-14 font-bold text-foreground">{value}</dd>
    </div>
  );
}

export function StatusNote({
  title,
  value,
  description,
  tone = 'default',
}: {
  title: string;
  value: string;
  description: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-danger-200 bg-danger-50 text-danger-700'
      : tone === 'warning'
        ? 'border-warning-300 bg-warning-50 text-warning-800'
        : 'border-border bg-muted text-foreground';
  return (
    <div className={`border px-3 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-12 font-bold">{title}</div>
      <div className="mt-1 text-16 font-bold tabular-nums">{value}</div>
      <p className="mt-1 text-12 leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function ActionStep({
  index,
  title,
  text,
  done,
}: {
  index: number;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? 'flex h-6 w-6 shrink-0 items-center justify-center border border-primary bg-primary text-11 font-bold text-primary-foreground'
            : 'flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-card text-11 font-bold text-muted-foreground'
        }
      >
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-13 font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-12 leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}
