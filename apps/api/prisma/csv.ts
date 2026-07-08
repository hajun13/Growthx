/**
 * 최소 CSV 파서 — Entra 사용자 목록 내보내기용.
 *
 * 의존성을 늘리지 않으려고 직접 짠다. 다루는 것:
 *  - 따옴표로 감싼 필드와 그 안의 콤마 (`"김,철수",a@b.c`)
 *  - 이스케이프된 따옴표 (`""`)
 *  - CRLF / LF 혼용
 *  - UTF-8 BOM (Entra 내보내기가 붙인다)
 *
 * 다루지 않는 것: 필드 안의 개행. Entra 사용자 목록에는 없다.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  // Entra CSV 는 UTF-8 BOM 으로 시작할 수 있다. 첫 컬럼명에 붙으면 키가 어긋난다.
  const keys = header.map((h) => h.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
