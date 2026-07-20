import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { writeManuals, type CaptureRow } from './manual-doc';

/**
 * 캡처 없이 문서만 다시 만든다 — 이미 찍힌 이미지와 캡처 이력(.capture-report.json)에서
 * 마크다운·매핑을 재생성한다. 문서 형식(화면당 파일·노션 매핑 등)만 바꿀 때 격리 스택을
 * 띄우지 않고 쓴다. 브라우저를 열지 않으므로 빠르다.
 *
 *   MANUAL_STACK 무관: pnpm -C e2e exec playwright test --config=playwright.manual.config.ts regen
 */
test('regenerate docs from capture report', () => {
  const report = path.join(__dirname, '..', '..', 'docs', 'manual', '.capture-report.json');
  if (!fs.existsSync(report)) {
    throw new Error('.capture-report.json 이 없어요 — 먼저 한 번 캡처(pnpm -C e2e manual)해야 합니다.');
  }
  const rows = JSON.parse(fs.readFileSync(report, 'utf8')) as CaptureRow[];
  const files = writeManuals(rows);
  console.log(`\n문서 재생성: ${files.length}개 파일 · 화면 ${rows.length}장`);
});
