import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, type Screen } from './screens';
import { ROLES, type RoleDef, type RoleKey } from './roles';

/**
 * 캡처 결과 → 역할별 사용자 매뉴얼 마크다운.
 *
 * 참고 매뉴얼(더존) 구성을 따른다: 제목 → 경로 → 설명 → 캡처 → 번호별 설명 표.
 * 역할마다 보이는 화면이 다르므로 문서도 역할별로 나눈다.
 */
export type CaptureRow = {
  role: RoleKey;
  key: string;
  image: string;
  missing: { index: number; desc: string; reason: string }[];
};

const OUT = path.join(__dirname, '..', '..', 'docs', 'manual');

export function writeManuals(rows: CaptureRow[]): string[] {
  fs.mkdirSync(OUT, { recursive: true });
  const written: string[] = [];

  for (const role of ROLES) {
    const mine = rows.filter((r) => r.role === role.key);
    if (mine.length === 0) continue;
    const file = path.join(OUT, `${role.slug}.md`);
    fs.writeFileSync(file, renderRole(role, mine), 'utf8');
    written.push(file);
  }

  fs.writeFileSync(path.join(OUT, 'README.md'), renderIndex(rows), 'utf8');
  written.push(path.join(OUT, 'README.md'));
  return written;
}

function renderRole(role: RoleDef, rows: CaptureRow[]): string {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const captured = SCREENS.filter((s) => s.roles.includes(role.key) && byKey.has(s.key));

  const lines: string[] = [
    `# 에너지엑스 인사 평가 — ${role.label} 사용자 매뉴얼`,
    '',
    role.intro,
    '',
    '> 화면 캡처의 이름·이메일·금액은 실제 값이 아닌 예시 데이터입니다.',
    '',
    '## 목차',
    '',
  ];
  for (const s of captured) lines.push(`- [${s.title}](#${anchor(s.title)}) — ${s.breadcrumb}`);
  lines.push('');

  for (const s of captured) lines.push('---', '', ...section(s, byKey.get(s.key)!, role));
  return lines.join('\n');
}

function section(s: Screen, row: CaptureRow, role: RoleDef): string[] {
  const out: string[] = [
    `## ${s.title}`,
    '',
    `**메뉴 경로** · ${s.breadcrumb}  `,
    `**주소** · \`${s.path}\``,
    '',
    s.desc,
    '',
    `![${s.title} 화면](images/${role.slug}/${row.image})`,
    '',
  ];

  const callouts = s.callouts ?? [];
  if (callouts.length > 0) {
    out.push('| 번호 | 설명 |', '| :---: | --- |');
    callouts.forEach((c, i) => {
      const failed = row.missing.some((m) => m.index === i + 1);
      // 그려지지 못한 콜아웃도 표에 남긴다 — 조용히 사라지면 검수에서 놓친다.
      out.push(`| ${i + 1} | ${c.desc}${failed ? ' _(⚠ 이미지에 표시되지 않음)_' : ''} |`);
    });
    out.push('');
  }
  return out;
}

function renderIndex(rows: CaptureRow[]): string {
  const lines = [
    '# 에너지엑스 인사 평가 — 사용자 매뉴얼',
    '',
    '역할에 따라 보이는 메뉴와 화면이 달라 문서를 나눠 두었습니다.',
    '',
  ];
  for (const role of ROLES) {
    const n = new Set(rows.filter((r) => r.role === role.key).map((r) => r.key)).size;
    if (n === 0) continue;
    lines.push(`- [${role.label} 매뉴얼](${role.slug}.md) — ${n}개 화면`);
  }
  lines.push(
    '',
    '팀장 매뉴얼은 구성원 화면을 모두 포함하고, 여기에 KPI 검토·부서장 평가처럼',
    '팀원을 관리하는 화면이 더해집니다.',
    '',
  );
  return lines.join('\n');
}

/** GitHub 마크다운 앵커 규칙 — 소문자화 + 공백을 하이픈으로. */
function anchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '');
}
