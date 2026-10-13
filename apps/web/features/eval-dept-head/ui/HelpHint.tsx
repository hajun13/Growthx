'use client';

// (?) 도움말 아이콘 + rich 툴팁 — L1 Tooltip/Button(help) 조합(구 components/HelpTooltip 외관·접근성 이름 동일).
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function HelpHint({ label = '설명 보기', content }: { label?: string; content: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="help" size="icon-2xs" aria-label={label}>
            <CircleHelp aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent variant="rich" side="bottom" align="start" sideOffset={4}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
