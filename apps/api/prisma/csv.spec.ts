import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('헤더와 본문을 객체 배열로 만든다', () => {
    const rows = parseCsv('userPrincipalName,mail\na@x.com,a@x.com\n');
    expect(rows).toEqual([{ userPrincipalName: 'a@x.com', mail: 'a@x.com' }]);
  });

  it('UTF-8 BOM 을 첫 컬럼명에서 제거한다', () => {
    // BOM 이 남으면 키가 "﻿userPrincipalName" 이 되어 매칭이 전부 실패한다.
    const rows = parseCsv('﻿userPrincipalName,mail\na@x.com,a@x.com\n');
    expect(Object.keys(rows[0])).toEqual(['userPrincipalName', 'mail']);
  });

  it('따옴표로 감싼 필드 안의 콤마를 필드 구분자로 보지 않는다', () => {
    const rows = parseCsv('displayName,mail\n"김,철수",a@x.com\n');
    expect(rows[0].displayName).toBe('김,철수');
    expect(rows[0].mail).toBe('a@x.com');
  });

  it('이스케이프된 따옴표("")를 하나로 되돌린다', () => {
    const rows = parseCsv('displayName,mail\n"그는 ""보스"" 다",a@x.com\n');
    expect(rows[0].displayName).toBe('그는 "보스" 다');
  });

  it('CRLF 줄바꿈을 처리한다', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('빈 필드를 빈 문자열로 둔다 — mail 이 비어도 행을 잃지 않는다', () => {
    // Entra 는 mail 속성이 없는 계정에 빈 값을 내보낸다. 이 행이 사라지면
    // preflight 가 그 사용자를 missing 으로 오판하지 못하고 아예 못 본다.
    const rows = parseCsv('userPrincipalName,mail\na@x.com,\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].mail).toBe('');
  });

  it('열이 부족한 행은 없는 컬럼을 빈 문자열로 채운다', () => {
    const rows = parseCsv('a,b,c\n1,2\n');
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('본문이 없으면 빈 배열', () => {
    expect(parseCsv('a,b\n')).toEqual([]);
  });

  it('완전히 빈 입력이면 빈 배열', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('필드 값의 앞뒤 공백을 잘라낸다', () => {
    const rows = parseCsv('userPrincipalName,mail\n  a@x.com  , b@x.com \n');
    expect(rows[0]).toEqual({ userPrincipalName: 'a@x.com', mail: 'b@x.com' });
  });
});
