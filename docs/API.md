# API 개요

JSON API이며 보호된 API에는 `Authorization: Bearer <JWT>`를 보냅니다. 거절 응답은 `{code,message}` 형식입니다. 400은 입력, 401은 인증, 403은 권한, 404는 대상 없음, 409는 상태·중복·정원 충돌입니다.

| Method / path | 인증 | 권한 | 상태·입력 조건 | 실패 코드 |
| --- | --- | --- | --- | --- |
| `POST /api/auth/signup` | 공개 | - | 아이디·이름·비밀번호 유효 | 400, 409 |
| `POST /api/auth/login` | 공개 | - | 아이디 존재, 비밀번호 일치 | 401 |
| `GET /api/studies?search=&sort=` | 공개 | - | 정렬 키 허용 목록 | - |
| `GET /api/studies/:id` | 공개 | - | 대상 존재; 지원 목록은 응답에서 제외 | 400, 404 |
| `POST /api/studies` | JWT | 로그인 회원 | 제목·정원·마감일 유효 | 400 |
| `PATCH /api/studies/:id` | JWT | 해당 스터디장 | 모집중, 정원 ≥ 승인 멤버 수 | 400, 403, 404, 409 |
| `DELETE /api/studies/:id` | JWT | 해당 스터디장 | 지원·멤버 이력 없음 | 403, 404, 409 |
| `PATCH /api/studies/:id/status` | JWT | 해당 스터디장 | 상태도 전이·시작 멤버·취소 조건 충족 | 403, 404, 409 |
| `POST /api/studies/:id/applications` | JWT | 로그인 회원, 본인 글 제외 | 모집중·마감일 전·중복 없음, 지원 메시지 500자 이하 | 400, 403, 404, 409 |
| `GET /api/studies/:id/applications` | JWT | 해당 스터디장 | 대상 존재 | 403, 404 |
| `PATCH /api/applications/:id/approve`, `/reject` | JWT | 해당 스터디장 | PENDING, 승인 시 모집·정원 조건 | 403, 404, 409 |
| `PATCH /api/applications/:id/cancel` | JWT | 지원자 본인 | PENDING·모집 기간 | 403, 404, 409 |
| `GET /api/me/applications`, `/api/me/studies` | JWT | 본인 데이터 | 토큰 주체 기준 | 401 |
| `PATCH /api/studies/:id/leave` | JWT | 승인 멤버 본인 | 종료 전 ACTIVE 멤버 | 403, 404, 409 |
| `GET /api/studies/:id/members`, `/tasks`, `/progress` | JWT | 스터디장·승인 멤버 | 대상 존재·멤버십 | 401, 403, 404 |
| `POST /api/studies/:id/tasks` | JWT | 스터디장·승인 멤버 | 종료 전, 제목·담당자 유효 | 400, 403, 404, 409 |
| `PATCH /api/tasks/:id/status` | JWT | 담당자·스터디장 | 순방향 전이, 종료 전 | 403, 404, 409 |
| `DELETE /api/tasks/:id` | JWT | 스터디장·승인 멤버 | 종료·취소 전, todo 삭제, doing/done 보관 | 403, 404, 409 |

모집글 목록·상세는 공개 API입니다. 지원자 목록은 별도 보호 API로 해당 스터디장에게만 제공합니다. 지원 응답에는 메시지·지원 시각이 포함되며 승인·거절 처리 시각과 처리자도 반환합니다. 정원 초과 승인 오류는 `정원이 모두 찼습니다. 더 이상 승인할 수 없습니다.`로 안내합니다. 취소된 지원서는 모집 기간 중 재지원하면 같은 행을 `PENDING`으로 되돌립니다. 스터디 취소 시 모든 대기 지원서를 `REJECTED`로 바꾸고 취소 상태를 같은 트랜잭션으로 저장합니다. 서비스 규칙은 `server/services/study-service.js`, 요청·인증 연결은 `server/app.js`, SQL 접근은 `server/repositories/study-repository.js`에 둡니다.

`/api/applications/:id/withdraw`와 `/api/applications/mine`은 이전 호환 경로이며, 신규 화면은 `/api/studies/:id/leave`와 `/api/me/applications`를 사용합니다.
