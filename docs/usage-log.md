# 코드 재사용 및 자료 활용 기록

## 이전 과제 코드 참고

| 자료 | 가져온 부분·출처 파일과 커밋 | 이번 프로젝트 변경 내용과 이유 |
| --- | --- | --- |
| 웹서비스설계 과제 2 | `src/app.js`, `src/application-service.js`, `src/errors.js`, `src/repository.js`, `src/db.js`, `src/auth.js`; [저장소](https://github.com/skfls0721/web-service-design-assignment-2), HEAD `5df85434d17116e0b9076d9c883c2e7baed95912` | 계층 분리, 오류 응답, SQLite 접근, JWT 인증, `BEGIN IMMEDIATE` 트랜잭션의 구조만 참고해 새로 작성했습니다. 행사·신청 도메인 코드는 복사하지 않았고, 정원·스터디 소유권·멤버십·작업 규칙을 새로 설계했습니다. |
| 9주차 게시판 페이지네이션 | `server.js`; [저장소](https://github.com/skfls0721/week09-board-pagination-practice), HEAD `92e5d08b16fed5efc569549a878a83942bbbe915` | 검색·정렬 입력 방어와 허용 정렬 키 개념만 참고했습니다. 목록 API에 고정된 정렬 화이트리스트를 새로 작성했습니다. |
| `wsd` | 코드 파일 복사 없음, 저장소 목록 확인만; [저장소](https://github.com/skfls0721/wsd), HEAD `9b332942c5f35f38fd32be36fbdbb0e16ef25b7f` | 코드 재사용 없음. |
| `jwt-board-hanip-review` | 코드 파일 복사 없음, 저장소 목록 확인만; [저장소](https://github.com/skfls0721/jwt-board-hanip-review), HEAD `1a84b28998fe7a605503085ef55264f2f413a560` | 코드 재사용 없음. |

이전 과제 저장소는 읽기만 했습니다. 변경·커밋·푸시는 이번 과제 저장소에만 수행합니다.

## AI 활용 기록

2026-11-10, Codex를 설계·구현 보조에 사용했습니다. 상태와 API 설계, 서버 계층과 화면 코드 초안, 테스트 시나리오와 문서 초안 생성을 요청했습니다. 생성된 코드는 사용자가 제시한 정원·소유권·멤버십·상태전이 규칙과 대조해 보완했습니다. 초기 테스트 도구 취약점 보고를 확인해 Vitest를 5.1.0으로 갱신했습니다. 사용자가 새 의존성으로 테스트 11개 통과와 `npm audit` 취약점 0건을 확인했습니다. 실제 화면 검증 결과는 별도로 기록해야 합니다.

2026-11-12, Codex가 지원 화면 사용 흐름을 보완했습니다. 모집글 상세에서 본인 지원 상태를 표시하고 모집 중·마감일 전의 대기 지원만 취소할 수 있게 했으며, 내 활동에서 지원 내역과 모집글 바로가기를 확인하도록 했습니다. 서버 취소 API도 같은 모집 기간 조건을 검사합니다. 제안된 동작을 사용자의 요구와 대조해 반영했습니다.

2026-11-12, Codex가 취소된 지원서를 모집 기간 중 재지원할 수 있도록 같은 지원서 행을 `PENDING`으로 되돌리는 규칙을 추가했습니다. `/api/me/applications`, `/api/me/studies`, `/api/studies/:id/members`, `/api/studies/:id/leave` API를 구현하고, 마감일·승인 상태·스터디 시작·취소 일괄 거절·탈퇴 시 작업 담당자 비우기 규칙을 반영했습니다. 사용자가 제시한 결정표와 대조해 구현했고, 자동 테스트 19개로 검증했습니다.
