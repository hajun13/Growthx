// 엑셀 임포트(multipart)·익스포트(blob 스트림) 헬퍼.
// 익스포트는 봉투 없는 .xlsx 바이너리(계약 예외) → blob 다운로드.
// 임포트는 정상 { data } 봉투 → ImportResult.

import { authHeader } from './auth';
import { ApiError } from './api';
import type { ApiErrorBody, ImportResult } from './types';

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

// POST /excel/import/* (multipart, field=file) → ImportResult.
export async function uploadExcel(
  path: string,
  file: File,
): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: authHeader(), // Content-Type 은 브라우저가 boundary 와 함께 자동 설정.
    body: form,
    cache: 'no-store',
  });
  let json: { data?: ImportResult } & Partial<ApiErrorBody>;
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }
  if (!res.ok) throw new ApiError(res.status, json.error);
  if (!json.data) throw new ApiError(res.status, undefined);
  return json.data;
}
