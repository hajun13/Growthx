import { IsArray, IsOptional, IsString } from 'class-validator';

export type CompensationIndexRowStatus = 'matched' | 'missing' | 'ambiguous';

export interface CompensationIndexRowDto {
  rowNo: number;
  status: CompensationIndexRowStatus;
  message: string | null;
  userId: string | null;
  matchedName: string | null;
  groupName: string | null;
  divisionName: string | null;
  teamName: string | null;
  duty: string | null;
  positionLabel: string | null;
  positionCode: string | null;
  name: string;
  displayName: string | null;
  hireDate: string | null;
  careerBaseMonths: number | null;
  priorCareerMonths: number | null;
  careerPosition: string | null;
  serviceYears: number | null;
  considerationExclusion: string | null;
  previousSalary: number | null;
  currentSalaryExclTransfer: number | null;
  currentSalary: number | null;
  adjustmentAmount: number | null;
  promotionPositionLabel: string | null;
  promotionPositionCode: string | null;
  incentiveAmount: number | null;
  note: string | null;
}

export interface CompensationIndexPreviewDto {
  rows: CompensationIndexRowDto[];
  summary: {
    total: number;
    matched: number;
    missing: number;
    ambiguous: number;
  };
}

export interface CompensationIndexImportResultDto extends CompensationIndexPreviewDto {
  imported: number;
  skipped: number;
}

export class CompensationIndexCommitDto {
  @IsString()
  cycleId!: string;

  @IsArray()
  rows!: CompensationIndexRowDto[];

  @IsOptional()
  @IsString()
  sourceName?: string;
}
