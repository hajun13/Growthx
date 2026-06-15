import type { Config } from 'tailwindcss';

// 디자인 토큰은 @growthx/ui preset 이 SSOT(여러 앱 공유, architecture.md §5).
// 여기선 content 경로만 앱별 지정. darkMode·theme·plugins 는 preset 에서 온다.
const config: Config = {
  presets: [require('@growthx/ui/tailwind-preset.cjs')],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
};

export default config;
