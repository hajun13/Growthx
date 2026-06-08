import { IsOptional, IsString } from 'class-validator';

/** 전역 검색 질의. q=검색어, limit=종류별 최대 결과 수(문자열, 서비스에서 정수 보정). */
export class SearchQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
