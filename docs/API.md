# API 개요

JSON API이며 보호된 API에는 `Authorization: Bearer <JWT>`를 보냅니다. 거절 응답은 `{code,message}` 형식입니다.

| Method / path | 권한 | 목적 |
| --- | --- | --- |
| `POST /api/auth/signup` | 공개 | 회원가입 |
| `POST /api/auth/login` | 공개 | 로그인, JWT 발급 |
| `GET /api/studies?search=&sort=` | 공개 | 검색·정렬 목록 (`latest`, `deadline`, `title`) |
| `POST /api/studies` | 로그인 | 모집글 등록 |
| `GET /api/studies/:id` | 공개 | 상세 조회 |
| `GET /api/studies/:id/members` | 스터디장·승인 멤버 | 멤버 목록 |
| `PATCH /api/studies/:id/status` | 스터디장 | 마감·시작·종료·취소 |
| `DELETE /api/studies/:id` | 스터디장 | 활동 이력이 없는 글 삭제 |
| `POST /api/studies/:id/applications` | 로그인 | 지원 |
| `GET /api/studies/:id/applications` | 해당 스터디장 | 지원서 관리 |
| `PATCH /api/applications/:id/approve`, `/reject` | 해당 스터디장 | 지원 승인·거절 |
| `PATCH /api/applications/:id/cancel` | 지원자 본인 | 대기 지원 취소 |
| `PATCH /api/applications/:id/withdraw` | 승인된 멤버 본인 | 스터디 탈퇴 |
| `GET /api/applications/mine` | 로그인 | 내 지원 현황 |
| `PATCH /api/studies/:id/leave` | 승인 멤버 본인 | 스터디 탈퇴, 배정 작업 담당자 비우기 |
| `GET /api/me/applications` | 로그인 | 내 지원 현황(정식 경로) |
| `GET /api/me/studies` | 로그인 | 내가 만든 스터디와 승인 멤버인 스터디 |
| `GET/POST /api/studies/:id/tasks` | 멤버·스터디장 | 작업 조회·등록 |
| `PATCH /api/tasks/:id/status` | 담당자·스터디장 | 작업 상태 변경 |
| `DELETE /api/tasks/:id` | 멤버·스터디장 | todo 삭제, 그 외 보관 |
| `GET /api/studies/:id/progress` | 멤버·스터디장 | 진행률 조회 |

취소된 지원서는 모집 기간 중 재지원하면 같은 행을 `PENDING`으로 되돌립니다. 스터디 취소 시 모든 대기 지원서를 `REJECTED`로 바꾸고 취소 상태를 같은 트랜잭션으로 저장합니다. 서비스 규칙은 `server/services/study-service.js`, 요청·인증 연결은 `server/app.js`, SQL 접근은 `server/repositories/study-repository.js`에 둡니다.
