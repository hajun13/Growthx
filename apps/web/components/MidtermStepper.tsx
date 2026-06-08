'use client';

// 중간 점검 진행 단계 시각화 — component-spec-midterm R3.
// employee: 5단계 / dept_head: 4단계. Toss 토큰만, 사각(radius 0).
import { CheckCircle2 } from 'lucide-react';
import { T } from '@/lib/toss';

export type StepStatus = 'done' | 'active' | 'pending';

export interface StepDef {
  label: string;
  subLabel?: string; // done이면 "완료", active이면 "지금 하세요" 등
  status: StepStatus;
}

const STEP_TOKEN: Record<
  StepStatus,
  {
    circleBg: string;
    circleBorder: string;
    numColor: string;
    labelColor: string;
    labelWeight: number;
  }
> = {
  done: {
    circleBg: T.blue500,
    circleBorder: 'none',
    numColor: '#fff',
    labelColor: T.grey900,
    labelWeight: 600,
  },
  active: {
    circleBg: '#fff',
    circleBorder: `2px solid ${T.blue500}`,
    numColor: T.blue500,
    labelColor: T.grey900,
    labelWeight: 700,
  },
  pending: {
    circleBg: T.grey100,
    circleBorder: `1px solid ${T.grey200}`,
    numColor: T.grey400,
    labelColor: T.grey500,
    labelWeight: 400,
  },
};

export function MidtermStepper({ steps }: { steps: StepDef[] }) {
  return (
    <ol
      aria-label="중간 점검 진행 단계"
      className="flex flex-col gap-3 md:flex-row md:items-start md:gap-0"
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: `1px solid ${T.grey200}`,
      }}
    >
      {steps.map((step, i) => {
        const tk = STEP_TOKEN[step.status];
        const isLast = i === steps.length - 1;
        const ariaLabel = `${step.label} - ${
          step.status === 'done'
            ? '완료됨'
            : step.status === 'active'
              ? '현재 단계'
              : '대기 중'
        }`;

        return (
          <li
            key={i}
            aria-current={step.status === 'active' ? 'step' : undefined}
            aria-label={ariaLabel}
            className="relative flex flex-1 flex-row items-center gap-2 md:flex-col md:items-center"
          >
            {/* 원 + 번호/체크 */}
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: tk.circleBg,
                border: tk.circleBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
              aria-hidden="true"
            >
              {step.status === 'done' ? (
                <CheckCircle2 size={14} color="#fff" />
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: tk.numColor,
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </span>

            {/* 라벨 */}
            <span className="flex flex-col md:items-center">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: tk.labelWeight,
                  color: tk.labelColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
              {step.subLabel && (
                <span
                  style={{
                    fontSize: 10,
                    color: T.grey500,
                    marginTop: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.subLabel}
                </span>
              )}
            </span>

            {/* 연결선 (마지막 제외) — md 이상에서만 표시 */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="hidden flex-1 md:block"
                style={{
                  height: 1,
                  background: step.status === 'done' ? T.blue500 : T.grey200,
                  alignSelf: 'flex-start',
                  marginTop: 12, // 원 중앙(24px/2) 정렬
                  width: '100%',
                  minWidth: 12,
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
