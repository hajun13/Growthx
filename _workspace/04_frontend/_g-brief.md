# G1~G7 기능 그룹 전환 — 서브에이전트 공통 브리프 (T1 완료 후)

디렉터리 `C:\Users\user\orca\Growthx`, 브랜치 `feat/shadcn-migration`. **첫 행동: `nextjs-frontend` 스킬을 Skill 도구로 호출(필수).** 그 다음 아래 3개를 읽어라(이 순서):
1. `_workspace/04_frontend/shadcn-guide.md` — L1 API·레거시→shadcn 매핑·토큰/타이포/스케일 매핑·lint 사용법. **이 문서가 이긴다.**
2. `_workspace/00_input/shadcn-migration/plan.md` §1(확정 결정) + `groups.md`(해야 할 일·검증·소유 경로 — 네 그룹 부분).
3. 루트 `DESIGN.md`(시각 SSOT) — 겉모습은 **현재 화면 그대로** 유지, 구현만 shadcn(L1)로. 새 디자인 발명 금지.

## T1 에서 얻은 현장 지식 (중요)
- Tailwind v4. 토큰 SSOT = `packages/ui/theme.css`. radius `rounded-sm`=6/`md`=8/`lg`·`xl`=10, 그림자 `shadow-xs|sm|md|lg|xl`(옅은 중립), px 타이포는 이미 `text-12`·`text-11h` 토큰으로 치환됨(숫자=px, h=+0.5). 크기는 px÷4 스케일(`w-22`=88px, `h-5.5`=22px, `max-w-110`). 임의값 오류 메시지가 대체 클래스를 알려준다.
- L1 `className` 은 **레이아웃(폭·높이·flex/grid·margin·z-index·overflow)만** 허용. 텍스트 계열(Label·CardTitle·TableCell·DialogTitle·AvatarFallback…)은 타이포+색(토큰), 컨테이너 계열(Card*·Dialog*·TableRow·Alert…)은 spacing 도 허용, `Input`/`Textarea`/`SelectTrigger` 는 타이포(text-12·tabular-nums·text-right)까지. 그 이상(색/패딩/모양/그림자/모션)은 **variant/size 를 쓰거나** 필요하면 `components/ui/<x>.tsx` cva 에 variant **추가**(기존 값 변경 금지, 다른 에이전트가 동시에 편집하므로 편집 직전 Read·최소 편집, 추가했으면 노트에 기록). 아이콘/접미사 붙은 입력은 padding 으로 덮지 말고 `InputGroup`.
- 동적 값(%너비·계산 좌표·데이터 색)은 `style={{ '--w': \`${pct}%\` } as React.CSSProperties}` + `w-(--w)` 같은 CSS 변수(통과함) 또는 정적 클래스 룩업 맵(`const TONE = { good: 'bg-success-50', … }`). `style={{ width: … }}` 직접은 금지. SVG attr 색은 `var(--color-…)`/`currentColor`.
- 인라인 색 토큰 `T.*`(lib/palette.ts) → 클래스는 가이드 §2-1 표. 등급은 `GradeChip`/`Badge variant="grade-*"`(C 등급 글씨만 진갈색 `text-gradeFg-c` — 구 렌더와 동일).
- 유지되는 L2(그대로 import 가능): AppShell, PageHeader, PageContainer, SectionHeader, DataTable, StatusBadge, GradeChip, CycleTypeBadge, FilterChipBar, OrgCascadeFilter, ScopeSelect, UserCombobox, DesignLabel, HeaderMetrics, NotificationBell, InfoBanner, PeriodBanner, WidgetCard, StatCard, ManualButton … 이관 대상 레거시 래퍼(Button/Card/Modal/Toast/Select/Tabs/TextField/Avatar/Collapsible/Pagination/SegmentedControl/Breadcrumb/HelpTooltip/SearchInput/States)는 L1 직접 사용으로 바꾼다(`@/components/Button` → `@/components/ui/button` 등, 매핑표 참고. `useToast().show` 는 `toast` from 'sonner').
- 공유 L2/L1/훅/lib 은 **수정 금지**(variant 추가 제외). 소유 밖 파일이 필요하면 고치지 말고 최종 보고에 적어라.
- 파일당 ~200줄 상한(architecture.md): 큰 파일을 전환하면서 200줄을 넘기면 같은 폴더의 `*Parts.tsx`/하위 컴포넌트로 분리해도 된다(공개 export·props 유지).
- **동작·문구·접근성 이름 불변** — 훅/API 호출/상태/조건 분기/텍스트/aria-label/버튼 라벨/heading/role 그대로. E2E 가 역할·라벨 로케이터로 회귀를 잡는다. 네이티브 `<select>`→Radix Select 로 바꿀 땐 label 연결(`aria-label`/`Label htmlFor`)과 기본값/빈 값(`value=""` 불가 → 센티넬 값) 처리에 주의. 네이티브 checkbox→`Checkbox`(`onCheckedChange`), radio→`RadioGroup`.
- 차트(recharts): `ui/chart` 의 `ChartContainer`+`ChartConfig`(색은 `var(--color-…)`) 패턴으로. 시각 동일성이 위험하면 recharts 직접 사용도 허용하되 lint 0 이어야 하고 노트에 사유 기록.
- 시각 패리티가 걱정되는 변경(높이·폰트 크기가 달라짐 등)은 노트의 "패리티 메모"에 적어라.

## 검증 (각자 — `next build`/`next dev` 금지, `.next` 가 깨진다)
```
pnpm -C apps/web exec eslint <소유 경로들> --max-warnings=0      # 위반 0 (cn 0.4 안내문은 이제 안 나옴)
pnpm -C apps/web typecheck                                        # 내 파일 에러 0 (남의 파일 에러는 보고만)
grep -rnE "from '@/components/(Button|Card|Modal|Toast|Select|Tabs|TextField|Avatar|Collapsible|Pagination|SegmentedControl|Breadcrumb|HelpTooltip|SearchInput|States)'" <소유 경로>   # 0
```
- 정당한 예외만 `// eslint-disable-next-line shadcn/<rule> -- <사유>`(또는 `no-restricted-syntax`), 최소화.
- 금지: git 파괴 명령(`checkout --`,`restore`,`reset`,`stash`,`clean`,`commit`,`push`), 소유 경로 밖 수정.
- 진행 노트 `_workspace/04_frontend/shadcn-<노트ID>.md`: 파일별 변경 요약, 예외(eslint-disable) 목록+사유, 추가한 L1 variant, 패리티 메모, 보류/질문.
- 최종 보고(짧게): 변경 파일 수, 위 3개 검증의 실제 수치, 예외 건수, 남은 것.
