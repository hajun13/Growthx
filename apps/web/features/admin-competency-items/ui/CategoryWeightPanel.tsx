'use client';

// 카테고리 가중치 편집 — 같은 카테고리 문항은 이 가중치를 함께 쓴다(문항당 가중치 아님).
// 평가표(직책자/비직책자)마다 카테고리 가중치 합 = 100% 일 때만 저장. 공통('all') 카테고리는 양쪽에 함께 반영.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  InputGroup, InputGroupAddon, InputGroupInput, InputGroupText,
} from '@/components/ui/input-group';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { CompetencyQuestion } from '../api';
import { competencyQuestionCommands } from '../hooks';
import { AUDIENCES, audienceSums, categoryWeightMap, inAudience, type Audience } from '../weights';
import { CardHead } from './CompositionCards';

interface Props {
  cycleId: string;
  questions: CompetencyQuestion[];
  onSaved: () => void;
}

interface CategoryRow {
  id: string;
  name: string;
  count: number;
  shared: boolean;
}

const parseWeight = (v: string): number | null =>
  /^\d+$/.test(v.trim()) && Number(v) <= 100 ? Number(v) : null;

export function CategoryWeightPanel({ cycleId, questions, onSaved }: Props) {
  const base = useMemo(() => categoryWeightMap(questions), [questions]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // 문항 목록이 바뀌면(저장·문항 추가 후 재조회) 편집값을 서버 값으로 초기화.
  useEffect(() => {
    setDraft(Object.fromEntries([...base].map(([id, w]) => [id, String(w)])));
  }, [base]);

  // 평가표별 카테고리 행 — 문항 순서(평가표 표시 순서) 기준 첫 등장 순.
  const sections = useMemo(() => {
    const result = {} as Record<Audience, CategoryRow[]>;
    for (const { key } of AUDIENCES) {
      const rows: CategoryRow[] = [];
      for (const q of questions) {
        if (!q.isActive || !inAudience(q, key)) continue;
        const row = rows.find((r) => r.id === q.categoryId);
        if (row) {
          row.count += 1;
          row.shared ||= q.targetGroup === 'all';
        } else {
          rows.push({ id: q.categoryId, name: q.categoryName ?? q.categoryId, count: 1, shared: q.targetGroup === 'all' });
        }
      }
      result[key] = rows;
    }
    return result;
  }, [questions]);

  const parsed = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, v] of Object.entries(draft)) {
      const w = parseWeight(v);
      if (w != null) map.set(id, w);
    }
    return map;
  }, [draft]);
  const allValid = Object.values(draft).every((v) => parseWeight(v) != null);
  const sums = audienceSums(questions, parsed);
  const changed = [...parsed].filter(([id, w]) => base.get(id) !== w);
  const sumsOk = AUDIENCES.every(({ key }) => sums[key] == null || sums[key] === 100);
  const canSave = changed.length > 0 && allValid && sumsOk;

  async function save() {
    setSaving(true);
    try {
      await competencyQuestionCommands.setCategoryWeights({
        cycleId,
        weights: changed.map(([categoryId, weight]) => ({ categoryId, weight })),
      });
      toast.success('카테고리 가중치를 저장했어요.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
    } finally {
      setSaving(false);
    }
  }

  if (questions.length === 0) return null;

  return (
    <Card>
      <CardHead
        title="카테고리 가중치"
        action={
          <div className="flex items-center gap-2">
            {changed.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setDraft(Object.fromEntries([...base].map(([id, w]) => [id, String(w)])))}
              >
                되돌리기
              </Button>
            )}
            <Button size="sm" loading={saving} disabled={!canSave} onClick={() => void save()}>
              저장
            </Button>
          </div>
        }
      />
      <CardContent className="p-4 md:p-5">
        <p className="mb-4 text-12 leading-5 text-muted-foreground">
          가중치는 문항이 아니라 카테고리에 매겨요. 같은 카테고리의 문항은 모두 이 가중치를 함께 쓰고,
          평가표(직책자/비직책자)마다 카테고리 가중치 합이 100%여야 저장돼요. 공통 카테고리는 두 평가표에 함께 반영돼요.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {AUDIENCES.map(({ key, label }) => (
            <AudienceSection
              key={key}
              label={label}
              rows={sections[key]}
              sum={sums[key]}
              draft={draft}
              onChange={(id, v) => setDraft((d) => ({ ...d, [id]: v }))}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AudienceSection({
  label, rows, sum, draft, onChange,
}: {
  label: string;
  rows: CategoryRow[];
  sum: number | null;
  draft: Record<string, string>;
  onChange: (categoryId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-13 font-bold text-foreground">{label} 평가표</span>
        {sum != null && (
          <Badge variant={sum === 100 ? 'success' : 'warning'}>
            합계 {sum}%{sum !== 100 && ' · 100%로 맞춰 주세요'}
          </Badge>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-12 text-muted-foreground">활성 문항이 없어요.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow plain>
              <TableHead className="text-11">카테고리</TableHead>
              <TableHead className="w-16 text-11">문항</TableHead>
              <TableHead className="w-28 text-11">가중치</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} plain>
                <TableCell className="text-13 font-semibold text-foreground">
                  <span className="break-keep">{r.name}</span>
                  {r.shared && <Badge variant="neutral" className="ml-1.5">공통</Badge>}
                </TableCell>
                <TableCell className="text-12 tabular-nums text-muted-foreground">{r.count}개</TableCell>
                <TableCell>
                  <InputGroup className="w-24">
                    <InputGroupInput
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      aria-label={`${r.name} 가중치`}
                      aria-invalid={parseWeight(draft[r.id] ?? '') == null || undefined}
                      value={draft[r.id] ?? ''}
                      onChange={(e) => onChange(r.id, e.target.value)}
                      className="text-right tabular-nums"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
