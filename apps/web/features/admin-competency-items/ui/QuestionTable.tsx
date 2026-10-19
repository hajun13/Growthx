'use client';

// 문항 목록 표 — 로딩/에러/빈 상태 포함. 헤더는 앱 헤더 아래로 sticky.
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { CompetencyQuestion } from '../api';
import { EmptyState, ErrorState } from './StateViews';
import { TARGET_GROUP_OPTIONS } from './QuestionForm';

const targetGroupLabel = (v: string) =>
  TARGET_GROUP_OPTIONS.find((o) => o.value === v)?.label ?? v;

interface Props {
  loading: boolean;
  error: unknown;
  questions: CompetencyQuestion[];
  onRetry: () => void;
  onEdit: (q: CompetencyQuestion) => void;
  onDelete: (q: CompetencyQuestion) => void;
  onToggleActive: (q: CompetencyQuestion) => void;
}

export function QuestionTable({ loading, error, questions, onRetry, onEdit, onDelete, onToggleActive }: Props) {
  return (
      <Card>
        <CardContent className="p-4 md:p-5">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : error ? (
            <ErrorState onRetry={onRetry} />
          ) : questions.length === 0 ? (
            <EmptyState title="문항이 없어요." description="문항 추가 버튼으로 첫 역량평가 문항을 등록해 주세요." />
          ) : (
            // bare — 앱 헤더(--gx-header-h) 아래로 고정되는 sticky 헤더를 위해 스크롤 래퍼 없이 렌더
            <Table bare>
              <TableHeader>
                <TableRow plain>
                  <TableHead sticky className="top-(--gx-header-h) text-10 uppercase tracking-wider">문항명</TableHead>
                  <TableHead sticky className="top-(--gx-header-h) w-25 text-10 uppercase tracking-wider">카테고리</TableHead>
                  <TableHead sticky className="top-(--gx-header-h) w-22.5 text-10 uppercase tracking-wider">대상</TableHead>
                  <TableHead sticky className="top-(--gx-header-h) w-24 text-10 uppercase tracking-wider">상태</TableHead>
                  <TableHead sticky className="top-(--gx-header-h) w-18" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="min-w-0">
                      <div className="text-13 font-semibold text-foreground">{q.text}</div>
                      {q.hint && <div className="mt-0.5 text-11h text-muted-foreground">{q.hint}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-xs bg-muted px-2 py-0.5 text-11 font-semibold text-foreground">
                        {q.categoryName ?? q.categoryId}
                      </span>
                    </TableCell>
                    <TableCell className="text-12 text-muted-foreground">{targetGroupLabel(q.targetGroup)}</TableCell>
                    <TableCell>
                      {/* 상태(라벨) + 토글 스위치 분리 — 라벨이 곧 토글이던 방향 모호함 제거 */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={q.isActive}
                          aria-label={`${q.text} ${q.isActive ? '비활성화' : '활성화'}`}
                          onCheckedChange={() => onToggleActive(q)}
                        />
                        <span className={`text-11h font-semibold ${q.isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {q.isActive ? '활성' : '비활성'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="icon-xs" onClick={() => onEdit(q)} aria-label="편집">
                          <Edit2 aria-hidden />
                        </Button>
                        <Button variant="outline" size="icon-xs" onClick={() => onDelete(q)} aria-label="삭제">
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
  );
}
