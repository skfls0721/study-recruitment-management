# API 개요

JSON API이며 보호된 API에는 `Authorization: Bearer <JWT>`를 보냅니다. 거절 응답은 `{code,message}` 형식입니다.

| Method / path | 권한 | 목적 |
| --- | --- | --- |
| `POST /api/auth/signup` | 공개 | 회원가입 |
| `POST /api/auth/login` | 공개 | 로그인, JWT 발급 |
| `GET /api/studies?search=&sort=` | 공개 | 검색·정렬 목록 (`latest`, `deadline`, `title`) |
| `POST /api/studies` | 로그인 | 모집글 등록 |
| `GET /api/studies/:id` | 공개 | 상세 조회 |
| `PATCH /api/studies/:id/status` | 스터디장 | 마감·시작·종료·취소 |
| `DELETE /api/studies/:id` | 스터디장 | 활동 이력이 없는 글 삭제 |
| `POST /api/studies/:id/applications` | 로그인 | 지원 |
| `GET /api/studies/:id/applications` | 해당 스터디장 | 지원서 관리 |
| `PATCH /api/applications/:id/approve`, `/reject` | 해당 스터디장 | 지원 승인·거절 |
| `PATCH /api/applications/:id/cancel` | 지원자 본인 | 대기 지원 취소 |
| `PATCH /api/applications/:id/withdraw` | 승인된 멤버 본인 | 스터디 탈퇴 |
| `GET /api/applications/mine` | 로그인 | 내 지원 현황 |
| `GET/POST /api/studies/:id/tasks` | 멤버·스터디장 | 작업 조회·등록 |
| `PATCH /api/tasks/:id/status` | 담당자·스터디장 | 작업 상태 변경 |
| `DELETE /api/tasks/:id` | 멤버·스터디장 | todo 삭제, 그 외 보관 |
| `GET /api/studies/:id/progress` | 멤버·스터디장 | 진행률 조회 |

서비스 규칙은 `server/services/study-service.js`, 요청·인증 연결은 `server/app.js`, SQL 접근은 `server/repositories/study-repository.js`에 둡니다.
