'use client';

import { InfoBanner } from './InfoBanner';
import { FileDropzone } from './FileDropzone';
import type { ImportResult } from '@/lib/types';

export interface RosterImportPanelProps {
  uploading?: boolean;
  result?: ImportResult | null;
  // POST /excel/import/roster — 멱등 업서트(업로드=반영).
  onSelect: (file: File) => void;
  onClear?: () => void;
}

// 명부 일괄 온보딩 — FileDropzone 경량 래퍼.
// roster 임포트는 단일 호출로 upsert(멱등)라 별도 커밋 단계 없음(showCommit=false).
export function RosterImportPanel({
  uploading,
  result,
  onSelect,
  onClear,
}: RosterImportPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <InfoBanner tone="info">
        그룹·본부·팀·직급·이름·이메일 6개 열의 .xlsx를 올리면 조직과 구성원을 한 번에
        만들어요. 초기 비밀번호는 1234, 첫 로그인 때 바꾸도록 안내돼요. 같은 이메일은
        갱신돼요.
      </InfoBanner>
      <FileDropzone
        uploading={uploading}
        result={result}
        showCommit={false}
        accept=".xlsx"
        maxSizeMB={5}
        templateHref="/excel/template/roster"
        templateLabel="명부 양식 받기"
        onSelect={onSelect}
        onClear={onClear}
      />
    </div>
  );
}
