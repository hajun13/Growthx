'use client';

// 중간점검 화면 공용 빈/에러 상태 — L1(Empty·Alert·Button) 조합.
// 구 States.EmptyState/ErrorState 의 문구·역할을 그대로 유지(동작·접근성 이름 불변).
import { useId } from 'react';
import { AlertTriangle, FileSearch } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20">
      <Empty className="p-5 md:p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold">{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}

export function ErrorState({
  message = '잠시 문제가 생겼어요. 다시 시도해 주세요.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="flex flex-col items-start gap-3">
      <AlertTriangle aria-hidden />
      <div>
        <AlertTitle>문제가 발생했어요</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Alert>
  );
}

// 구 Card(title, action) 헤더 — 하단 보더 + 15px 볼드 제목 + 우측 액션(L1 Card 조합).
export function CardTitleBar({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
        <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">
          {children}
        </CardTitle>
        {action}
      </CardHeader>
    </div>
  );
}

// 구 Card(title, action, padding) 호환 — L1 Card + CardTitleBar + CardContent 조합(중간점검 패널 공용).
export function PanelCard({
  title,
  action,
  padding = 'md',
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  padding?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      {(title || action) && <CardTitleBar action={action}>{title}</CardTitleBar>}
      <CardContent className={padding === 'sm' ? 'p-4' : 'p-4 md:p-5'}>{children}</CardContent>
    </Card>
  );
}

// 라벨 숨김(sr-only) 다행 입력 — 구 TextField(hideLabel multiline) 호환(L1 Label + Textarea).
export function HiddenLabelTextarea({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y"
      />
    </div>
  );
}
