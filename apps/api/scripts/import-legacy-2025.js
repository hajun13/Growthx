// 1회성 운영 데이터 적재: 2025 과거결과(평가자정리) 임포트.
// 실제 ExcelService.importLegacyResults 코드경로를 Nest 컨텍스트에서 호출(인증/HTTP 우회 — 운영자 적재).
// 사용: node scripts/import-legacy-2025.js <xlsxPath> <actorUserId> [cycleId]
const { NestFactory } = require('@nestjs/core');
const fs = require('fs');

(async () => {
  const [, , xlsxPath, actorUserId, cycleId] = process.argv;
  if (!xlsxPath || !actorUserId) {
    console.error('usage: node scripts/import-legacy-2025.js <xlsxPath> <actorUserId> [cycleId]');
    process.exit(2);
  }
  const { AppModule } = require('/app/dist/src/app.module');
  const { ExcelService } = require('/app/dist/src/modules/excel/excel.service');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const excel = app.get(ExcelService);
    const buf = fs.readFileSync(xlsxPath);
    const res = await excel.importLegacyResults(buf, cycleId || undefined, actorUserId);
    console.log('IMPORT_RESULT_JSON=' + JSON.stringify(res));
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error('IMPORT_ERROR', e && e.stack ? e.stack : e);
  process.exit(1);
});
