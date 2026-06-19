'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormErrorItem {
  id?: string;
  label: string;
  message: string;
}

export interface FormErrorSummaryProps {
  title?: string;
  errors: FormErrorItem[];
  className?: string;
}

export function FormErrorSummary({
  title = '입력 내용을 확인해 주세요',
  errors,
  className,
}: FormErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <section
      role="alert"
      tabIndex={-1}
      className={cn(
        'rounded-lg border border-danger-500/40 bg-danger-50 px-4 py-3 text-danger-700',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold leading-5">{title}</h2>
          <ul className="mt-2 space-y-1 text-[13px] leading-5">
            {errors.map((error) => (
              <li key={`${error.label}-${error.message}`}>
                {error.id ? (
                  <a className="underline underline-offset-2" href={`#${error.id}`}>
                    {error.label}: {error.message}
                  </a>
                ) : (
                  <span>
                    {error.label}: {error.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
