'use client';

import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface HelpTooltipProps {
  content: ReactNode;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * @deprecated — L1(@/components/ui/tooltip) 사용으로 이관 대상.
 * (?) 아이콘 트리거 + rich 툴팁을 묶은 호환 래퍼.
 */
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
          <Button
            variant="help"
            size="icon-2xs"
            aria-label={label}
            className={className}
          >
            <CircleHelp aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent variant="rich" side={side} align={align} sideOffset={4}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
