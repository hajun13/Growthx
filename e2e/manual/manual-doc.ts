import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, type Screen } from './screens';
import { ROLES, type RoleKey } from './roles';

/**
 * 캡처 결과 → 화면당 마크다운 파일 + 노션 링크 매핑.
 *
 * 배포 방식: 각 화면을 노션 페이지 하나로 임포트하고, 앱의 페이지별 [매뉴얼] 버튼이
 * 그 노션 URL 로 연결된다. 그래서 역할당 한 파일이 아니라 화면당 한 파일로 쪼갠다.
 *
 *   docs/manual/<역할>/<키>.md    ← 화면 하나 = 노션 페이지 하나
 *   docs/manual/notion-map.json   ← 라우트·화면 ↔ 노션 URL(빈칸) 매핑. 앱 버튼이 읽는다.
 *   docs/manual/README.md         ← 역할별 목차
 */
export type CaptureRow = {
  role: RoleKey;
  key: string;
  image: string;
  missing: { index: number; desc: string; reason: string }[];
};

const OUT = path.join(__dirname, '..', '..', 'docs', 'manual');

/** 노션 매핑 한 줄 — 앱이 (역할, 경로)로 조회해 버튼 링크를 만든다. */
type NotionEntry = {
  role: RoleKey;
  key: string;
  title: string;
  breadcrumb: string;
  /** 앱 라우트. 같은 경로에 여러 화면(모달·탭)이 붙을 수 있다. */
  path: string;
  /** 이 경로의 대표 화면인가 — 페이지 버튼은 대표 화면의 URL 로 연결한다. */
  primary: boolean;
  /** 저장소 안 마크다운 파일(노션에 임포트할 원본). */
  file: string;
  /** 노션 페이지 URL — 페이지를 만든 뒤 채운다. 앱은 빈 값이면 버튼을 숨긴다. */
  notionUrl: string;
};

export function writeManuals(rows: CaptureRow[]): string[] {
  fs.mkdirSync(OUT, { recursive: true });
  const written: string[] = [];
  const entries: NotionEntry[] = [];
  // 기존 매핑이 있으면 채워둔 notionUrl 을 보존한다 — 재생성해도 링크가 날아가지 않게.
  const prevUrls = readPrevUrls();

  for (const role of ROLES) {
    const captured = SCREENS.filter(
      (s) => s.roles.includes(role.key) && rows.some((r) => r.role === role.key && r.key === s.key),
    );
    const primaryKeyByPath = resolvePrimaries(captured);

    for (const s of captured) {
      const row = rows.find((r) => r.role === role.key && r.key === s.key)!;
      // 파일명·폴더명을 한국어로 — 노션은 파일명을 페이지 제목으로 쓰므로 한글로 보이게 한다.
      // (이미지는 English key 유지 — 본문에 인라인 임베드라 이름이 노출되지 않는다.)
      const fileName = `${safeName(s.title)}.md`;
      const file = path.join(OUT, role.label, fileName);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, renderScreen(s, row, role.slug), 'utf8');
      written.push(file);

      const primary = primaryKeyByPath.get(s.path) === s.key;
      entries.push({
        role: role.key,
        key: s.key,
        title: s.title,
        breadcrumb: s.breadcrumb,
        path: s.path,
        primary,
        file: `docs/manual/${role.label}/${fileName}`,
        notionUrl: prevUrls.get(`${role.key}/${s.key}`) ?? '',
      });
    }
  }

  const mapFile = path.join(OUT, 'notion-map.json');
  fs.writeFileSync(mapFile, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  written.push(mapFile);

  // 웹앱이 소비할 경량 맵. 앱은 docs/ 를 직접 import 하지 않으므로 여기서 생성한다.
  // 대표 화면 + URL 이 채워진 항목만 담는다 — 앱은 (role, path)로 조회해 버튼 링크를 만든다.
  const webMap = path.join(__dirname, '..', '..', 'apps', 'web', 'lib', 'manualLinks.generated.ts');
  written.push(writeWebMap(webMap, entries));

  const indexFile = path.join(OUT, 'README.md');
  fs.writeFileSync(indexFile, renderIndex(rows), 'utf8');
  written.push(indexFile);

  return written;
}

/** 웹용 경량 맵 모듈 { [role]: { [path]: url } } — 대표·URL 채워진 항목만. */
function writeWebMap(file: string, entries: NotionEntry[]): string {
  const byRole: Record<string, Record<string, string>> = {};
  for (const e of entries) {
    if (!e.primary || !e.notionUrl) continue;
    (byRole[e.role] ??= {})[e.path] = e.notionUrl;
  }
  const body =
    '// 자동 생성 — docs/manual/notion-map.json 에서 파생. 직접 수정 금지.\n' +
    '// 갱신: notion-map.json 의 notionUrl 을 채운 뒤 e2e regen(e2e/manual/README.md 참고).\n' +
    '// { 역할: { 라우트 경로: 노션 URL } } — URL 이 채워진 대표 화면만 담긴다.\n' +
    `export const MANUAL_LINKS: Record<string, Record<string, string>> = ${JSON.stringify(byRole, null, 2)};\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

/**
 * 경로별 대표 화면을 정한다. 앱의 페이지 버튼이 어느 화면의 노션 URL 로 갈지 결정한다.
 *  1) 그 경로에 `primary: true` 가 있으면 그것.
 *  2) 없으면 `primary: false` 가 아닌 화면 중 순서상 첫 번째.
 */
function resolvePrimaries(screens: Screen[]): Map<string, string> {
  const byPath = new Map<string, Screen[]>();
  for (const s of screens) {
    const arr = byPath.get(s.path) ?? [];
    arr.push(s);
    byPath.set(s.path, arr);
  }
  const result = new Map<string, string>();
  for (const [p, group] of byPath) {
    const forced = group.find((s) => s.primary === true);
    const firstEligible = group.find((s) => s.primary !== false);
    const chosen = forced ?? firstEligible ?? group[0];
    result.set(p, chosen.key);
  }
  return result;
}

/** 파일명으로 쓸 수 없는 문자를 걸러낸다(대부분의 제목엔 없지만 안전장치). */
function safeName(title: string): string {
  // 윈도우 금지 문자 \ / : * ? " < > | 를 공백으로. 앞뒤 공백·점 정리.
  return title.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
}

/** 화면 하나짜리 문서 — 노션 페이지 한 장이 된다. */
function renderScreen(s: Screen, row: CaptureRow, slug: string): string {
  const lines: string[] = [
    `# ${s.title}`,
    '',
    `**메뉴 경로** · ${s.breadcrumb}  `,
    `**주소** · \`${s.path}\``,
    '',
    s.desc,
    '',
    // 노션 임포트 시 상대 경로 이미지는 폴더(zip) 임포트에서만 따라온다 — README 참고.
    `![${s.title} 화면](../images/${slug}/${row.image})`,
    '',
  ];

  const callouts = s.callouts ?? [];
  if (callouts.length > 0) {
    lines.push('| 번호 | 설명 |', '| :---: | --- |');
    callouts.forEach((c, i) => {
      const failed = row.missing.some((m) => m.index === i + 1);
      lines.push(`| ${i + 1} | ${c.desc}${failed ? ' _(⚠ 이미지에 표시되지 않음)_' : ''} |`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function renderIndex(rows: CaptureRow[]): string {
  const lines = [
    '# 에너지엑스 인사 평가 — 사용자 매뉴얼',
    '',
    '화면마다 파일 하나로 나눠 두었습니다. 각 파일을 노션 페이지 하나로 임포트하고,',
    '앱의 페이지별 [매뉴얼] 버튼을 그 노션 URL 로 연결해 배포합니다.',
    '버튼 ↔ URL 연결은 `notion-map.json` 이 관리합니다(노션 페이지를 만든 뒤 `notionUrl` 을 채우세요).',
    '',
    '> **노션 임포트 팁** : 이미지는 `images/<역할>/` 에 있고 각 문서가 상대 경로로 참조합니다.',
    '> 이미지를 함께 올리려면 `docs/manual` 폴더를 통째로 zip 해 노션 *가져오기 > Markdown & CSV* 로',
    '> 임포트하세요. 개별 파일만 붙여넣으면 이미지는 따로 업로드해야 합니다.',
    '',
  ];

  for (const role of ROLES) {
    const captured = SCREENS.filter(
      (s) => s.roles.includes(role.key) && rows.some((r) => r.role === role.key && r.key === s.key),
    );
    if (captured.length === 0) continue;
    lines.push(`## ${role.label} (${captured.length}개 화면)`, '');
    for (const s of captured) {
      // 링크 경로는 공백·한글이 있어 URL 인코딩한다(마크다운 링크 깨짐 방지).
      const href = encodeURI(`${role.label}/${safeName(s.title)}.md`);
      lines.push(`- [${s.title}](${href}) — \`${s.path}\` · ${s.breadcrumb}`);
    }
    lines.push('');
  }

  lines.push(
    '팀장 매뉴얼은 구성원 화면을 모두 포함하고, KPI 검토·부서장 평가처럼 팀원을',
    '관리하는 화면이 더해집니다.',
    '',
  );
  return lines.join('\n');
}

/** 이전 notion-map.json 의 채워진 URL 을 (role/key)→url 로 읽어온다. */
function readPrevUrls(): Map<string, string> {
  const map = new Map<string, string>();
  const f = path.join(OUT, 'notion-map.json');
  if (!fs.existsSync(f)) return map;
  try {
    const prev = JSON.parse(fs.readFileSync(f, 'utf8')) as NotionEntry[];
    for (const e of prev) if (e.notionUrl) map.set(`${e.role}/${e.key}`, e.notionUrl);
  } catch {
    /* 손상된 파일은 무시하고 새로 만든다 */
  }
  return map;
}
