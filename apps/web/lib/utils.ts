import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// 테마(`packages/ui/theme.css`)의 px 타이포 토큰(text-12, text-11h …)을 font-size 그룹으로 등록.
// 미등록 시 tailwind-merge 가 `text-12` 를 글자색으로 오인해 `text-muted-foreground` 와 서로 덮어쓴다.
const TEXT_PX_TOKENS = [
  '9h', '10', '10h', '11', '11h', '12', '12h', '13', '13h', '14', '14h',
  '15', '15h', '16', '17', '18', '20', '21', '22', '30', '32', '34', '40',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TEXT_PX_TOKENS }],
    },
  },
});

// shadcn/ui 표준 className 머지 헬퍼.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
