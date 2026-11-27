# API 개요

JSON API이며 보호된 API에는 `Authorization: Bearer <JWT>`를 보냅니다. 거절 응답은 `{code,message}` 형식입니다. 400은 입력, 401은 인증, 403은 권한, 404는 대상 없음, 409는 상태·중복·정원 충돌입니다.

| Method / path | 인증 | 권한 | 상태·입력 조건 | 실패 코드 |
| --- | --- | --- | --- | --- |
| `POST /api/auth/signup` | 공개 | - | 아이디·이름·비밀번호 유효 | 400, 409 |
| `POST /api/auth/login` | 공개 | - | 아이디 존재, 비밀번호 일치 | 401 |
| `GET /api/studies?search=&sort=` | 공개 | - | 정렬 키 허용 목록; KST 마감일이 지난 모집은 `CLOSED/DEADLINE`으로 갱신 | - |
| `GET /api/studies/:id` | 공개 | - | 대상 존재; KST 마감일이 지난 모집 자동 마감; 지원 목록은 응답에서 제외 | 400, 404 |
| `POST /api/studies` | JWT | 로그인 회원 | 제목·정원·마감일 유효 | 400 |
| `PATCH /api/studies/:id` | JWT | 해당 스터디장 | 모집중, 정원 ≥ 승인 멤버 수 | 400, 403, 404, 409 |
| `DELETE /api/studies/:id` | JWT | 해당 스터디장 | 지원·멤버 이력 없음 | 403, 404, 409 |
| `PATCH /api/studies/:id/status` | JWT | 해당 스터디장 | 모집중일 때 수동 마감·취소, 마감+멤버 있을 때 시작, 진행중일 때 종료; 시작은 대기 지원 일괄 거절 | 403, 404, 409 |
| `POST /api/studies/:id/applications` | JWT | 로그인 회원, 본인 글 제외 | 모집중·KST 마감일 전·중복 없음, 지원 메시지 500자 이하; 지난 날짜면 자동 마감 | 400, 403, 404, 409 |
| `GET /api/studies/:id/applications` | JWT | 해당 스터디장 | 대상 존재 | 403, 404 |
| `PATCH /api/applications/:id/approve`, `/reject` | JWT | 해당 스터디장 | PENDING, 승인 시 모집·정원 조건; 마지막 자리는 승인·멤버 추가·`CLOSED/FULL`·나머지 대기 지원 REJECTED가 원자적 | 403, 404, 409 |
| `PATCH /api/applications/:id/cancel` | JWT | 지원자 본인 | PENDING·모집 기간 | 403, 404, 409 |
| `GET /api/me/applications`, `/api/me/studies` | JWT | 본인 데이터 | 토큰 주체 기준 | 401 |
| `PATCH /api/studies/:id/leave` | JWT | 승인 멤버 본인 | 종료 전 ACTIVE 멤버 | 403, 404, 409 |
| `GET /api/studies/:id/members`, `/participants`, `/tasks`, `/progress` | JWT | 스터디장·승인 멤버 | 대상 존재·멤버십; 참여자 응답에 역할·미보관 담당 작업 수 | 401, 403, 404 |
| `POST /api/studies/:id/tasks` | JWT | 스터디장·승인 멤버 | 진행 중 `ACTIVE`, 제목·담당자 유효; 회원은 본인만 담당자로 지정, 스터디장은 참여자 지정 | 400, 403, 404, 409 |
| `PATCH /api/tasks/:id/status` | JWT | 담당자·스터디장 | `ACTIVE`, 순방향 전이만 | 403, 404, 409 |
| `DELETE /api/tasks/:id` | JWT | 스터디장·승인 멤버 | `ACTIVE`, todo 삭제, doing/done 보관 | 403, 404, 409 |

모집글 목록·상세는 공개 API입니다. 지원자 목록은 별도 보호 API로 해당 스터디장에게만 제공합니다. 지원 응답에는 메시지·지원 시각이 포함되며 승인·거절 처리 시각과 처리자도 반환합니다. 마감 사유는 `close_reason`의 `FULL`, `DEADLINE`, `MANUAL`로 구분합니다. 날짜 마감은 KST 날짜가 바뀌는 첫 요청에서 지연 처리하므로 모집 마감일 당일 23:59:59까지 유효합니다. 마지막 자리 승인으로 `FULL` 마감되면 승인·멤버 추가·마감·나머지 대기 지원의 `REJECTED` 처리를 한 트랜잭션에서 완료합니다. 멤버 탈퇴 후에는 자동 재개하지 않습니다. `DEADLINE`·`MANUAL` 마감에 남아 있는 대기 지원은 승인할 수 없으며 스터디 시작 시 `REJECTED` 처리됩니다. 취소된 지원서는 모집 기간 중 재지원하면 같은 행을 `PENDING`으로 되돌립니다. 스터디 취소 시 모든 대기 지원서를 `REJECTED`로 바꾸고 취소 상태를 같은 트랜잭션으로 저장합니다. 서비스 규칙은 `server/services/study-service.js`, 요청·인증 연결은 `server/app.js`, SQL 접근은 `server/repositories/study-repository.js`에 둡니다.

`/api/applications/:id/withdraw`와 `/api/applications/mine`은 이전 호환 경로이며, 신규 화면은 `/api/studies/:id/leave`와 `/api/me/applications`를 사용합니다.
