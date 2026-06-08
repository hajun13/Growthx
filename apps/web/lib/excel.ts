// 엑셀 임포트(multipart)·익스포트(blob 스트림) 헬퍼.
// 익스포트는 봉투 없는 .xlsx 바이너리(계약 예외) → blob 다운로드.
// 임포트는 정상 { data } 봉투 → ImportResult.

import { authHeader } from './auth';
import { ApiError } from './api';
import type { ApiErrorBody, ImportResult } from './types';

// 쿼리스트링 직렬화 — undefined/null 값은 생략. uploadExcel·다운로드 공용.
function withQuery(
  path: string,
  query?: Record<string, string | number | undefined | null>,
): string {
  if (!query) return path;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  if (!qs) return path;
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const PREFIX = '/api/v1';

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${RAW_BASE}${PREFIX}${p}`;
}

// 인증 헤더 포함 GET → blob 반환(스트림 파일). 다운로드/새탭 공용.
export async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: authHeader(),
    cache: 'no-store',
  });
  if (!res.ok) {
    // 에러 응답은 JSON 봉투일 수 있음.
    let body: ApiErrorBody['error'] | undefined;
    try {
      body = ((await res.json()) as ApiErrorBody).error;
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, body);
  }
  return res.blob();
}

// GET /excel/export/* → blob 받아 브라우저 다운로드 트리거.
export async function downloadExcel(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: authHeader(),
    cache: 'no-store',
  });
  if (!res.ok) {
    // 에러 응답은 JSON 봉투일 수 있음.
    let body: ApiErrorBody['error'] | undefined;
    try {
      body = ((await res.json()) as ApiErrorBody).error;
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, body);
  }

  const blob = await res.blob();
  // Content-Disposition 의 filename 우선, 없으면 fallback.
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// POST /excel/import/* (multipart, field=file) → { data } 봉투를 unwrap.
// 기본 응답 타입은 ImportResult(조직·설정 임포트). 과거결과 임포트처럼 다른
// 리포트 shape 가 필요하면 제네릭 T 로 지정하고, cycleId 등은 query 로 붙인다.
export async function uploadExcel<T = ImportResult>(
  path: string,
  file: File,
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(buildUrl(withQuery(path, query)), {
    method: 'POST',
    headers: authHeader(), // Content-Type 은 브라우저가 boundary 와 함께 자동 설정.
    body: form,
    cache: 'no-store',
  });
  let json: { data?: T } & Partial<ApiErrorBody>;
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }
  if (!res.ok) throw new ApiError(res.status, json.error);
  if (!json.data) throw new ApiError(res.status, undefined);
  return json.data;
}
