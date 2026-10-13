// @shadcn/lint — 디자인 시스템 규칙 게이트 (DESIGN.md + _workspace/04_frontend/shadcn-guide.md).
// 위반 0 이 build/test 선행 조건(루트 turbo.json: build·test dependsOn lint).
import { plugin as shadcn } from '@shadcn/lint';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';

// no-restyle 계약 — 기본은 layout(배치·폭·flex/grid·margin·z-index·overflow)만 허용.
// 텍스트 계열은 타이포·색(테마 토큰만 — no-raw-colors 가 별도로 강제), 컨테이너 계열은 spacing 허용.
// "Only the last matching contract applies" → 각 계약이 layout 을 직접 재선언한다.
const TEXT_LIKE =
  '^(Label|Field(Label|Description|Legend|Title|Error|Content)|Card(Title|Description)|(Alert)?Dialog(Title|Description)|Sheet(Title|Description)|Alert(Title|Description)|Empty(Title|Description|Header)|Table(Head|Cell|Caption)|DropdownMenu(Label|Item)|Command(Empty|Item)|AvatarFallback|Kbd|PaginationLink)$';
const CONTAINER_LIKE =
  '^(Card(Header|Content|Footer|Action)?|(Alert)?Dialog(Content|Header|Footer)|Sheet(Content|Header|Footer)|(Popover|HoverCard|DropdownMenu|Select)Content|Empty|EmptyContent|FieldGroup|FieldSet|InputGroupAddon|TableRow|Table|TableHeader|TableBody|TableFooter|Alert)$';
const noRestyleContracts = [
  { pattern: TEXT_LIKE, allow: ['layout', 'typography', 'color'] },
  { pattern: CONTAINER_LIKE, allow: ['layout', 'spacing'] },
  // 밀집 표 입력의 글자 크기·숫자 정렬(text-12, tabular-nums)은 허용 — 색·패딩(아이콘/접미사는 InputGroup)은 L1 소유.
  { pattern: '^(Input|Textarea|SelectTrigger|InputGroupInput)$', allow: ['layout', 'typography'] },
  { pattern: '^(Skeleton|Separator|Progress)$', allow: ['layout', 'shape'] },
];

const GUIDE = 'DESIGN.md / _workspace/04_frontend/shadcn-guide.md';

// 코드베이스에 `// eslint-disable-next-line react-hooks/exhaustive-deps` 등이 이미 있다.
// 해당 플러그인을 설치하지 않으므로, 디렉티브가 "rule not found" 로 깨지지 않게 빈 규칙만 등록한다.
const noopRule = { meta: { schema: [] }, create: () => ({}) };
const hooksStub = { rules: { 'exhaustive-deps': noopRule, 'rules-of-hooks': noopRule } };
const nextStub = { rules: { 'no-img-element': noopRule } };

export default defineConfig([
  { linterOptions: { reportUnusedDisableDirectives: 'off' } }, // react-hooks/next 스텁 규칙은 보고가 없어 disable 디렉티브가 "미사용"으로 보인다
  globalIgnores(['.next/**', '.next-*/**', 'node_modules/**', 'next-env.d.ts', '**/*.generated.ts']),
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { shadcn, 'react-hooks': hooksStub, '@next/next': nextStub },
    settings: {
      shadcn: {
        ui: '@/components/ui',
        note: `See ${GUIDE} for tokens, variants and approved exceptions.`,
      },
    },
    rules: {
      'shadcn/no-restyle': ['error', { allow: ['layout'], contracts: noRestyleContracts }],
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/require-static-classes': 'error',
      // L3(features/app)·L2 에서 원시 폼/표 요소 손스타일 금지 — L1(@/components/ui)을 쓴다. (components/ui/** 는 아래서 해제)
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^(button|input|select|textarea|table)$/]",
          message:
            'Raw <button>/<input>/<select>/<textarea>/<table> are not allowed outside components/ui. Use the shadcn primitives (Button, Input, Select, Textarea, Table, Checkbox, Switch, …) from @/components/ui — see _workspace/04_frontend/shadcn-guide.md (legacy → shadcn mapping). Genuine exceptions need // eslint-disable-next-line no-restricted-syntax -- <reason>.',
        },
      ],
    },
  },
  {
    // L1(shadcn 프리미티브)이 스타일을 "소유"한다 — 구조값(ring-[3px] 등) 허용. 색·인라인 스타일 규칙은 유지.
    files: ['components/ui/**'],
    rules: {
      'shadcn/no-restyle': 'off',
      'shadcn/no-arbitrary-values': 'off',
      'shadcn/require-static-classes': 'off',
      'no-restricted-syntax': 'off',
    },
  },
]);
