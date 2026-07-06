'use client';

// 역량평가 문항 카드 — 문항별 독립 카드(그림자) + 카테고리 아이콘·색 + 접기/펼치기.
// 시안 Part/image 6.png 재현. 브리프 §9(part-revision-brief.md) 카테고리 색·아이콘 매핑.
import { ChevronDown, Crown, Users, Share2, Award, Lightbulb, type LucideIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { CompetencyQuestion } from '../api';

const SCORE_LABELS = ['매우미흡', '미흡', '보통', '우수', '매우우수'];

interface CatCfg {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  badgeBg: string;
  badgeColor: string;
}
const CAT_CFG: Record<string, CatCfg> = {
  리더십: { icon: Crown, iconColor: '#0257CE', iconBg: '#EAF2FE', badgeBg: '#EAF2FE', badgeColor: '#0257CE' },
  협업: { icon: Users, iconColor: '#0B7A47', iconBg: '#E3F7EC', badgeBg: '#E3F7EC', badgeColor: '#0B7A47' },
  전문성: { icon: Award, iconColor: '#0E7E85', iconBg: '#E4FBFB', badgeBg: '#E4FBFB', badgeColor: '#0E7E85' },
  혁신: { icon: Lightbulb, iconColor: '#C2570A', iconBg: '#FFEEDD', badgeBg: '#FFEEDD', badgeColor: '#C2570A' },
};
const FALLBACK_CAT_CFG: CatCfg = {
  icon: Award,
  iconColor: '#6B6980',
  iconBg: '#F4F5FA',
  badgeBg: '#F4F5FA',
  badgeColor: '#6B6980',
};
// '지원'·'공유' 등 교류형 문구가 있는 협업 문항은 Share2 아이콘(브리프 §9 관측).
const SHARE_HINT = /지원|공유|교류/;
function catCfg(name: string | null | undefined, text?: string): CatCfg {
  const base = name ? (CAT_CFG[name] ?? FALLBACK_CAT_CFG) : FALLBACK_CAT_CFG;
  if (name === '협업' && text && SHARE_HINT.test(text)) {
    return { ...base, icon: Share2 };
  }
  return base;
}

export function QuestionCard({
  question,
  score,
  comment,
  isOpen,
  onToggle,
  onScore,
  onComment,
  readOnly,
}: {
  question: CompetencyQuestion;
  score: number;
  comment: string;
  isOpen: boolean;
  onToggle: () => void;
  onScore: (score: number) => void;
  onComment: (comment: string) => void;
  readOnly: boolean;
}) {
  const catName = question.categoryName ?? question.categoryId ?? '';
  const cfg = catCfg(question.categoryName ?? question.categoryId, question.text);
  const Icon = cfg.icon;
  const labels = question.options && question.options.length === 5 ? question.options : SCORE_LABELS;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* 문항 헤더 — 카테고리 아이콘 배지 + 카테고리명 + 질문 강조 + 접기/펼치기 토글 */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: cfg.iconBg, color: cfg.iconColor }}
        >
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
            >
              {catName}
            </span>
            {score > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {score}점
              </span>
            )}
          </div>
          <p className="text-[14.5px] font-semibold leading-snug text-foreground">{question.text}</p>
          {question.hint && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{question.hint}</p>
          )}
        </div>
        <ChevronDown
          size={18}
          aria-hidden
          className={`mt-1 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 응답 영역 — 아주 연한 배경 톤 */}
      {isOpen && (
        <div className="border-t border-border px-5 py-4" style={{ background: '#F8F9FD' }}>
          {/* 점수 선택 버튼 — 도메인 특화 5점 선택 그리드 */}
          <div className="mb-4 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((s) => {
              const on = score === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onScore(s)}
                  disabled={readOnly}
                  aria-pressed={on}
                  className={`flex min-h-[68px] flex-col items-center justify-start gap-1 rounded-md border px-1.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
                    on
                      ? 'border-primary bg-card text-primary ring-1 ring-primary/30'
                      : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/60'
                  }`}
                >
                  <span className="text-xs font-bold">{s}</span>
                  <span className={`text-center text-[11px] leading-snug break-keep ${on ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                    {labels[s - 1]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 근거 텍스트에어리어 */}
          <Textarea
            value={comment}
            onChange={(e) => onComment(e.target.value)}
            disabled={readOnly}
            placeholder="평가 근거를 작성하세요."
            className="min-h-[64px] resize-none bg-card text-xs"
          />
        </div>
      )}
    </div>
  );
}
