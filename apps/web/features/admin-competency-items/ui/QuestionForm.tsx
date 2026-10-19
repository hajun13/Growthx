'use client';

// 역량 문항 추가/편집 폼 + 구성 점검 지표 카드.
import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { CompetencyCategory } from '../api';

export const TARGET_GROUP_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'manager', label: '직책자' },
  { value: 'non_manager', label: '비직책자' },
] as const;

export const DEFAULT_OPTIONS = ['매우미흡', '미흡', '보통', '우수', '매우우수'];

export interface QuestionDraft {
  text: string;
  hint: string;
  categoryId: string;
  targetGroup: string;
  options: string[];
  isActive: boolean;
}

export const emptyDraft: QuestionDraft = {
  text: '', hint: '', categoryId: '',
  targetGroup: 'all', options: [...DEFAULT_OPTIONS], isActive: true,
};

export function QuestionMetric({
  label,
  value,
  muted,
  warn,
}: {
  label: string;
  value: string;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="border border-border bg-card px-3 py-2.5">
      <div className="text-11 font-semibold text-muted-foreground">{label}</div>
      <div
        className={`mt-1 tabular-nums text-18 font-bold ${
          warn ? 'text-warning-700' : muted ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// 라벨 + 입력(단일행/여러행) 묶음.
function FormField({
  label, value, onChange, required, placeholder, multiline, rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          aria-required={required || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="resize-y"
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          required={required}
          aria-required={required || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

interface FormProps {
  draft: QuestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  categories: CompetencyCategory[];
  onAddCategory: (name: string) => Promise<void>;
  /** 확인 모달을 여는 콜백 — 즉시 삭제하지 않는다. */
  onDeleteCategory: (cat: CompetencyCategory) => void;
}

const CHIP_ON =
  'inline-flex items-center gap-1.5 rounded-xs border border-primary bg-primary px-2.5 py-1.5 text-12 font-medium text-primary-foreground';
const CHIP_OFF =
  'inline-flex items-center gap-1.5 rounded-xs border border-border bg-card px-2.5 py-1.5 text-12 font-medium text-muted-foreground';

export function QuestionForm({ draft, setDraft, categories, onAddCategory, onDeleteCategory }: FormProps) {
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  async function handleAddCat() {
    if (!newCat.trim() || addingCat) return;
    setAddingCat(true);
    await onAddCategory(newCat);
    setNewCat('');
    setAddingCat(false);
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <FormField
        label="문항명"
        value={draft.text}
        onChange={(v) => setDraft((d) => ({ ...d, text: v }))}
        required
        placeholder="예) 방향 제시 및 비전 공유"
      />
      <FormField
        label="설명 (선택)"
        value={draft.hint}
        onChange={(v) => setDraft((d) => ({ ...d, hint: v }))}
        multiline
        rows={2}
        placeholder="문항에 대한 보조 설명"
      />

      {/* 카테고리 — 선택 + 추가/삭제 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-11 font-semibold text-muted-foreground">카테고리</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span key={cat.id} className={draft.categoryId === cat.id ? CHIP_ON : CHIP_OFF}>
              <Button
                variant="bare"
                size="bare"
                onClick={() => setDraft((d) => ({ ...d, categoryId: cat.id }))}
              >
                {cat.name}
              </Button>
              <Button
                variant="bare"
                size="bare"
                onClick={() => onDeleteCategory(cat)}
                aria-label={`${cat.name} 삭제`}
              >
                <X aria-hidden className="opacity-60" />
              </Button>
            </span>
          ))}
          {categories.length === 0 && (
            <span className="text-12 text-muted-foreground">등록된 카테고리가 없어요. 아래에서 추가하세요.</span>
          )}
        </div>
        {/* 새 카테고리 추가 */}
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddCat();
              }
            }}
            placeholder="새 카테고리 추가"
            className="h-9 flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleAddCat()}
            disabled={addingCat || !newCat.trim()}
            loading={addingCat}
          >
            {!addingCat && <Plus aria-hidden />}
            추가
          </Button>
        </div>
      </div>

      {/* 대상 — 라디오. 가중치는 문항이 아니라 카테고리 단위라 여기서 받지 않는다(카테고리 가중치 패널). */}
      <div className="flex flex-col gap-1.5">
        <span className="text-11 font-semibold text-muted-foreground">대상</span>
        <RadioGroup
          value={draft.targetGroup}
          onValueChange={(v) => setDraft((d) => ({ ...d, targetGroup: v }))}
        >
          {TARGET_GROUP_OPTIONS.map((opt) => (
            <Label key={opt.value} className="cursor-pointer text-13 font-normal text-foreground">
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </Label>
          ))}
        </RadioGroup>
        <span className="text-11 text-muted-foreground">
          가중치는 카테고리 단위예요. 문항은 선택한 카테고리의 가중치를 따르고, 새 카테고리라면 화면의
          &lsquo;카테고리 가중치&rsquo;에서 정해 주세요.
        </span>
      </div>

      {/* 5지선다 보기 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-11 font-semibold text-muted-foreground">5지선다 보기</span>
          <span className="text-11 text-muted-foreground">1점 = 가장 낮음 · 5점 = 가장 높음</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tabular-nums inline-flex size-7 shrink-0 items-center justify-center rounded-xs bg-primary text-12 font-bold text-primary-foreground">
                {i + 1}
              </span>
              <Input
                value={opt}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => {
                    const next = [...d.options];
                    next[i] = v;
                    return { ...d, options: next };
                  });
                }}
                placeholder={DEFAULT_OPTIONS[i]}
              />
            </div>
          ))}
        </div>
      </div>

      <Label className="cursor-pointer text-13 font-medium text-muted-foreground">
        <Checkbox
          checked={draft.isActive}
          onCheckedChange={(c) => setDraft((d) => ({ ...d, isActive: c === true }))}
        />
        활성화 (임직원 화면에 노출)
      </Label>
    </div>
  );
}
