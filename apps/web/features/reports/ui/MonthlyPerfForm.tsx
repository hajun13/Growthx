'use client';

// 월별 실적 입력(hr_admin) — 월·카테고리·목표·실적 → 저장 시 달성률·등급 자동 산정.
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { kpiCategoryLabel } from '@/lib/ui';
import type { KpiCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createMonthlyPerformance } from '../api';
import { ReportCard } from './ReportCard';

export function MonthlyPerfForm({
  cycleId,
  departmentId,
  onSaved,
}: {
  cycleId: string;
  departmentId: string;
  onSaved: () => void;
}) {
  const uid = useId();
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState<KpiCategory>('revenue');
  const [target, setTarget] = useState('');
  const [actual, setActual] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const m = Number(month);
    if (!m || m < 1 || m > 12) {
      toast.error('월(1-12)을 입력해 주세요.', { duration: 8000 });
      return;
    }
    setBusy(true);
    try {
      await createMonthlyPerformance({
        cycleId,
        departmentId,
        year: new Date().getFullYear(),
        month: m,
        category,
        targetAmount: Number(target) || 0,
        actualAmount: Number(actual) || 0,
      });
      toast.success('월별 실적을 저장했어요.');
      setMonth('');
      setTarget('');
      setActual('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReportCard
      title="월별 실적 입력"
      action={<p className="text-xs text-muted-foreground">월·카테고리·목표·실적 입력 시 달성률·등급이 자동 산정돼요.</p>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field>
            <FieldLabel htmlFor={`${uid}-month`}>월</FieldLabel>
            <InputGroup>
              <InputGroupInput id={`${uid}-month`} type="number" value={month} onChange={(e) => setMonth(e.target.value)} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>월</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-category`}>카테고리</FieldLabel>
            <Select value={category} onValueChange={(v) => setCategory(v as KpiCategory)}>
              <SelectTrigger id={`${uid}-category`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(kpiCategoryLabel) as KpiCategory[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {kpiCategoryLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-target`}>목표</FieldLabel>
            <Input id={`${uid}-target`} type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${uid}-actual`}>실적</FieldLabel>
            <Input id={`${uid}-actual`} type="number" value={actual} onChange={(e) => setActual(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" loading={busy} onClick={() => void save()}>
            실적 저장
          </Button>
        </div>
      </div>
    </ReportCard>
  );
}
