# 코드 재사용 및 자료 활용 기록

## 이전 과제 코드 참고

| 자료 | 확인한 범위 | 이번 프로젝트 반영 | 출처 |
| --- | --- | --- | --- |
| 웹서비스설계 과제 2 | Express 앱과 오류 응답, 서비스/저장소 분리, SQLite, JWT 검증, `BEGIN IMMEDIATE` 승인 트랜잭션 | 경계와 구현 패턴을 참고해 도메인에 맞게 새로 작성. 과제 코드를 복사해 이전 서비스의 행사·신청 구조를 유지하지 않음 | [web-service-design-assignment-2](https://github.com/skfls0721/web-service-design-assignment-2), 확인한 원본 HEAD `5df85434d17116e0b9076d9c883c2e7baed95912` |
| 9주차 게시판 페이지네이션 | 검색·정렬 매개변수의 방어적 처리와 화이트리스트 정렬 개념 | 목록 API의 허용 정렬 키를 고정하는 방식에 참고 | [week09-board-pagination-practice](https://github.com/skfls0721/week09-board-pagination-practice) |
| `wsd`, `jwt-board-hanip-review` | 저장소 목록 확인만 진행 | 코드 재사용 없음 | [wsd](https://github.com/skfls0721/wsd), [jwt-board-hanip-review](https://github.com/skfls0721/jwt-board-hanip-review) |

이전 과제 저장소는 읽기만 했습니다. 변경·커밋·푸시는 이번 과제 저장소에만 수행합니다.

## AI 활용 기록

2026-11-10, Codex를 설계·구현 보조에 사용했습니다. 상태와 API 설계, 서버 계층과 화면 코드 초안, 테스트 시나리오와 문서 초안 생성을 요청했습니다. 생성된 코드는 사용자가 제시한 정원·소유권·멤버십·상태전이 규칙과 대조해 보완했습니다. 초기 테스트 도구 취약점 보고를 확인해 Vitest를 5.1.0으로 갱신했습니다. 사용자가 새 의존성으로 테스트 11개 통과와 `npm audit` 취약점 0건을 확인했습니다. 실제 화면 검증 결과는 별도로 기록해야 합니다.

2026-11-12, Codex가 지원 화면 사용 흐름을 보완했습니다. 모집글 상세에서 본인 지원 상태를 표시하고 모집 중·마감일 전의 대기 지원만 취소할 수 있게 했으며, 내 활동에서 지원 내역과 모집글 바로가기를 확인하도록 했습니다. 서버 취소 API도 같은 모집 기간 조건을 검사합니다. 제안된 동작을 사용자의 요구와 대조해 반영했습니다.
