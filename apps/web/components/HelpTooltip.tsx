'use client';

import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface HelpTooltipProps {
  content: ReactNode;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function HelpTooltip({
  content,
  label = '설명 보기',
  side = 'bottom',
  align = 'start',
  className,
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground',
              'cursor-help transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
              className,
            )}
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={4}
          className="max-w-[328px] rounded-md bg-foreground px-4 py-4 text-[12px] font-normal leading-[18px] text-background shadow-elev-2"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
