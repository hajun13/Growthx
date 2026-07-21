# 에너지엑스 인사 평가 — 사용자 매뉴얼

화면마다 파일 하나로 나눠 두었습니다. 각 파일을 노션 페이지 하나로 임포트하고,
앱의 페이지별 [매뉴얼] 버튼을 그 노션 URL 로 연결해 배포합니다.
버튼 ↔ URL 연결은 `notion-map.json` 이 관리합니다(노션 페이지를 만든 뒤 `notionUrl` 을 채우세요).

> **노션 임포트 팁** : 이미지는 `images/<역할>/` 에 있고 각 문서가 상대 경로로 참조합니다.
> 이미지를 함께 올리려면 `docs/manual` 폴더를 통째로 zip 해 노션 *가져오기 > Markdown & CSV* 로
> 임포트하세요. 개별 파일만 붙여넣으면 이미지는 따로 업로드해야 합니다.

## 구성원 (16개 화면)

- [대시보드](%EA%B5%AC%EC%84%B1%EC%9B%90/%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C.md) — `/dashboard` · 대시보드
- [KPI 작성](%EA%B5%AC%EC%84%B1%EC%9B%90/KPI%20%EC%9E%91%EC%84%B1.md) — `/kpi` · 인사평가 > KPI 작성
- [본인평가](%EA%B5%AC%EC%84%B1%EC%9B%90/%EB%B3%B8%EC%9D%B8%ED%8F%89%EA%B0%80.md) — `/eval/self` · 인사평가 > 본인평가
- [중간 점검 — 내 중간 점검](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%82%B4%20%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80.md) — `/eval/midterm` · 인사평가 > 중간 점검
- [역량평가](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%97%AD%EB%9F%89%ED%8F%89%EA%B0%80.md) — `/competency/eval` · 인사평가 > 역량평가
- [내 평가표](%EA%B5%AC%EC%84%B1%EC%9B%90/%EB%82%B4%20%ED%8F%89%EA%B0%80%ED%91%9C.md) — `/eval/my` · 인사평가 > 내 평가표
- [중간 점검 — 등급 기준 펼치기](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%93%B1%EA%B8%89%20%EA%B8%B0%EC%A4%80%20%ED%8E%BC%EC%B9%98%EA%B8%B0.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 등급 기준
- [중간 점검 — 목표 재조정 신청](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%AA%A9%ED%91%9C%20%EC%9E%AC%EC%A1%B0%EC%A0%95%20%EC%8B%A0%EC%B2%AD.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 목표 재조정
- [평가결과 상세](%EA%B5%AC%EC%84%B1%EC%9B%90/%ED%8F%89%EA%B0%80%EA%B2%B0%EA%B3%BC%20%EC%83%81%EC%84%B8.md) — `/eval/result` · 인사평가 > 평가결과 > 상세
- [이의제기 신청](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%9D%B4%EC%9D%98%EC%A0%9C%EA%B8%B0%20%EC%8B%A0%EC%B2%AD.md) — `/eval/result` · 인사평가 > 평가결과 상세 > 이의제기
- [알림함 — 안읽음](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%95%8C%EB%A6%BC%ED%95%A8%20%E2%80%94%20%EC%95%88%EC%9D%BD%EC%9D%8C.md) — `/notifications` · 헤더 > 알림 > 전체 보기 > 안읽음
- [이의제기](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%9D%B4%EC%9D%98%EC%A0%9C%EA%B8%B0.md) — `/appeals` · 모니터링 > 이의제기
- [알림함](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%95%8C%EB%A6%BC%ED%95%A8.md) — `/notifications` · 헤더 > 알림 > 전체 보기
- [설정 — 알림](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%84%A4%EC%A0%95%20%E2%80%94%20%EC%95%8C%EB%A6%BC.md) — `/admin/settings` · 기타 > 설정
- [설정 — 비밀번호 변경](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%84%A4%EC%A0%95%20%E2%80%94%20%EB%B9%84%EB%B0%80%EB%B2%88%ED%98%B8%20%EB%B3%80%EA%B2%BD.md) — `/admin/settings` · 기타 > 설정 > 비밀번호 변경
- [조직도](%EA%B5%AC%EC%84%B1%EC%9B%90/%EC%A1%B0%EC%A7%81%EB%8F%84.md) — `/org` · 직접 이동 (/org)

## 팀장 (24개 화면)

- [대시보드](%ED%8C%80%EC%9E%A5/%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C.md) — `/dashboard` · 대시보드
- [KPI 작성](%ED%8C%80%EC%9E%A5/KPI%20%EC%9E%91%EC%84%B1.md) — `/kpi` · 인사평가 > KPI 작성
- [본인평가](%ED%8C%80%EC%9E%A5/%EB%B3%B8%EC%9D%B8%ED%8F%89%EA%B0%80.md) — `/eval/self` · 인사평가 > 본인평가
- [중간 점검 — 내 중간 점검](%ED%8C%80%EC%9E%A5/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%82%B4%20%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80.md) — `/eval/midterm` · 인사평가 > 중간 점검
- [역량평가](%ED%8C%80%EC%9E%A5/%EC%97%AD%EB%9F%89%ED%8F%89%EA%B0%80.md) — `/competency/eval` · 인사평가 > 역량평가
- [내 평가표](%ED%8C%80%EC%9E%A5/%EB%82%B4%20%ED%8F%89%EA%B0%80%ED%91%9C.md) — `/eval/my` · 인사평가 > 내 평가표
- [중간 점검 — 등급 기준 펼치기](%ED%8C%80%EC%9E%A5/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%93%B1%EA%B8%89%20%EA%B8%B0%EC%A4%80%20%ED%8E%BC%EC%B9%98%EA%B8%B0.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 등급 기준
- [중간 점검 — 목표 재조정 신청](%ED%8C%80%EC%9E%A5/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EB%AA%A9%ED%91%9C%20%EC%9E%AC%EC%A1%B0%EC%A0%95%20%EC%8B%A0%EC%B2%AD.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 목표 재조정
- [평가결과 상세](%ED%8C%80%EC%9E%A5/%ED%8F%89%EA%B0%80%EA%B2%B0%EA%B3%BC%20%EC%83%81%EC%84%B8.md) — `/eval/result` · 인사평가 > 평가결과 > 상세
- [알림함 — 안읽음](%ED%8C%80%EC%9E%A5/%EC%95%8C%EB%A6%BC%ED%95%A8%20%E2%80%94%20%EC%95%88%EC%9D%BD%EC%9D%8C.md) — `/notifications` · 헤더 > 알림 > 전체 보기 > 안읽음
- [이의제기](%ED%8C%80%EC%9E%A5/%EC%9D%B4%EC%9D%98%EC%A0%9C%EA%B8%B0.md) — `/appeals` · 모니터링 > 이의제기
- [알림함](%ED%8C%80%EC%9E%A5/%EC%95%8C%EB%A6%BC%ED%95%A8.md) — `/notifications` · 헤더 > 알림 > 전체 보기
- [설정 — 알림](%ED%8C%80%EC%9E%A5/%EC%84%A4%EC%A0%95%20%E2%80%94%20%EC%95%8C%EB%A6%BC.md) — `/admin/settings` · 기타 > 설정
- [설정 — 비밀번호 변경](%ED%8C%80%EC%9E%A5/%EC%84%A4%EC%A0%95%20%E2%80%94%20%EB%B9%84%EB%B0%80%EB%B2%88%ED%98%B8%20%EB%B3%80%EA%B2%BD.md) — `/admin/settings` · 기타 > 설정 > 비밀번호 변경
- [조직도](%ED%8C%80%EC%9E%A5/%EC%A1%B0%EC%A7%81%EB%8F%84.md) — `/org` · 직접 이동 (/org)
- [KPI 검토](%ED%8C%80%EC%9E%A5/KPI%20%EA%B2%80%ED%86%A0.md) — `/kpi/review` · 인사평가 > KPI 검토
- [KPI 검토 — 반려하기](%ED%8C%80%EC%9E%A5/KPI%20%EA%B2%80%ED%86%A0%20%E2%80%94%20%EB%B0%98%EB%A0%A4%ED%95%98%EA%B8%B0.md) — `/kpi/review` · 인사평가 > KPI 검토 > 반려
- [KPI 검토 — 일괄 승인](%ED%8C%80%EC%9E%A5/KPI%20%EA%B2%80%ED%86%A0%20%E2%80%94%20%EC%9D%BC%EA%B4%84%20%EC%8A%B9%EC%9D%B8.md) — `/kpi/review` · 인사평가 > KPI 검토 > 일괄 승인
- [부서장 평가](%ED%8C%80%EC%9E%A5/%EB%B6%80%EC%84%9C%EC%9E%A5%20%ED%8F%89%EA%B0%80.md) — `/eval/dept-head` · 인사평가 > 부서장 평가
- [중간 점검 — 구성원 점검·평가](%ED%8C%80%EC%9E%A5/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EA%B5%AC%EC%84%B1%EC%9B%90%20%EC%A0%90%EA%B2%80%C2%B7%ED%8F%89%EA%B0%80.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 구성원 점검·평가
- [중간 점검 — 재조정 검토](%ED%8C%80%EC%9E%A5/%EC%A4%91%EA%B0%84%20%EC%A0%90%EA%B2%80%20%E2%80%94%20%EC%9E%AC%EC%A1%B0%EC%A0%95%20%EA%B2%80%ED%86%A0.md) — `/eval/midterm` · 인사평가 > 중간 점검 > 재조정 검토
- [평가결과](%ED%8C%80%EC%9E%A5/%ED%8F%89%EA%B0%80%EA%B2%B0%EA%B3%BC.md) — `/eval/result` · 인사평가 > 평가결과
- [분포 모니터링](%ED%8C%80%EC%9E%A5/%EB%B6%84%ED%8F%AC%20%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A7%81.md) — `/reports` · 모니터링 > 분포 모니터링
- [평가 결과표](%ED%8C%80%EC%9E%A5/%ED%8F%89%EA%B0%80%20%EA%B2%B0%EA%B3%BC%ED%91%9C.md) — `/reports/evaluation-summary` · 실적관리 > 평가 결과표

팀장 매뉴얼은 구성원 화면을 모두 포함하고, KPI 검토·부서장 평가처럼 팀원을
관리하는 화면이 더해집니다.
