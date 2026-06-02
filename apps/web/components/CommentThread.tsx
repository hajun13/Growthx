'use client';

import { useState } from 'react';
import { cx, roleLabel } from '@/lib/ui';
import type { Role } from '@/lib/types';
import { TextField } from './TextField';
import { Button } from './Button';

export interface CommentItem {
  id: string;
  authorName: string;
  authorRole: Role;
  round?: 1 | 2;
  quarter?: 1 | 2 | 3 | 4;
  content: string;
  createdAt: string;
}

export interface CommentThreadProps {
  comments: CommentItem[];
  editable?: boolean;
  required?: boolean;
  onAdd?: (content: string, quarter?: number) => void;
}

export function CommentThread({
  comments,
  editable,
  required,
  onAdd,
}: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const empty = comments.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {empty ? (
        <p className="text-sm text-neutral-500">아직 코멘트가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700"
              >
                {c.authorName.slice(0, 1)}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-neutral-900">
                    {c.authorName}
                  </span>
                  <span className="text-neutral-500">
                    {roleLabel[c.authorRole]}
                  </span>
                  {c.round && (
                    <span className="rounded-full bg-neutral-100 px-2 py-[1px] text-xs text-neutral-600">
                      {c.round === 2 ? '2차 본부장' : '1차 팀장'}
                    </span>
                  )}
                  {c.quarter && (
                    <span className="rounded-full bg-neutral-100 px-2 py-[1px] text-xs text-neutral-600">
                      {c.quarter}분기
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-base text-neutral-700">
                  {c.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {required && empty && (
        <p className="text-sm text-danger-600">
          코멘트를 작성해야 제출할 수 있어요.
        </p>
      )}

      {editable && (
        <div className="flex flex-col gap-2">
          <TextField
            label="코멘트"
            hideLabel
            multiline
            rows={3}
            value={draft}
            onChange={setDraft}
            placeholder="평가 코멘트를 작성해 주세요."
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!draft.trim()}
              onClick={() => {
                if (!draft.trim()) return;
                onAdd?.(draft.trim());
                setDraft('');
              }}
            >
              코멘트 등록
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
