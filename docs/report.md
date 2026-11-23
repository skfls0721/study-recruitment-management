# StudyBoard Term Project 보고서

웹서비스설계 한국어 분반 · 2026학년도 2학기 · 개인 프로젝트
작성 기준일: 2026-11-23 · 제출 마감: 2026-12-18 23:59 (한국 시간)

> 이 보고서는 StudyBoard 코드 변경과 2026-11-23 자동 테스트 기록을 기준으로 갱신했다. 아직 배포하지 않은 코드의 JCloud 동작과 캡처·영상처럼 확인하지 않은 항목은 미확인으로 표시했다. 비밀번호와 비밀키는 기록하지 않았다.

## 0. 제출 정보와 채점기준 대응표

| 항목 | 내용 |
|---|---|
| 학번과 이름 | 202323035 · 홍나린 (개인 프로젝트) |
| 서비스명 | StudyBoard (스터디 모집·관리 서비스) |
| 기술 조합과 버전 | Node.js 24.x, Express 5, SQLite (`node:sqlite`), JWT, bcryptjs, HTML/CSS/JavaScript, Vitest 5.1.0 + Supertest |
| GitHub URL | https://github.com/skfls0721/study-recruitment-management |
| 코드 기준 SHA | `1cb71dd9324c7da1388b5a73db587de5a4d87772` (기능 구현 커밋; LMS에는 문서를 포함한 최종 `main` SHA를 기재) |
| JCloud 접속 주소 | http://s.jedutools.io:40141 |
| 시연 영상 링크 | 미제출. 촬영·공개 링크 설정 후 LMS에 기재 |
| 역할별 테스트 계정 | `leaderA`, `leaderB`, `memberC`; 비밀번호는 LMS 제출란에서만 제공 |

| 채점 항목 | 심사자가 볼 내용 | 확인 위치 |
|---|---|---|
| 문제 정의와 설계 (20) | 사용자·목적, 데이터 모델, 업무 규칙 | 1절, 2절 |
| 핵심 기능 구현 (30) | 핵심 흐름, 규칙의 실제 동작 | 3절, 4절 |
| 예외 처리와 테스트 (20) | 권한·상태·중복, 트랜잭션·테스트 | 4절, 5절, 6절 |
| 배포와 문서화 (10) | JCloud·README·재현 절차 | 7절 |
| 시연과 코드 이해 (20) | 정상·예외 동작, 승인 코드 설명 | 3절, 8절, 10절 |

## 1. 서비스 소개와 구현 범위

**한 문장 정의:** 스터디장이 모집글을 올리고 회원이 지원하면, 스터디장이 정원과 상태를 확인해 승인하고, 승인된 멤버가 스터디 방에서 작업을 관리하며 스터디장이 활동을 종료하는 서비스다.

단톡방이나 폼으로 스터디원을 모집할 때 생기는 정원 초과, 중복 지원, 승인 누락을 서버 규칙으로 줄이는 것이 목적이다. 사용자는 모집글 소유자인 스터디장과 지원 회원이며, 승인이 끝나면 회원은 스터디 멤버가 된다. 핵심 흐름은 모집글 등록 → 지원 → 승인·거절 → 작업 관리와 진행률 확인 → 종료다. Node.js·Express·SQLite는 수업에서 다룬 웹 API와 영속 저장 흐름을 연결하기 위해 선택했고, 브라우저는 별도 프런트엔드 빌드 없이 HTML/CSS/JavaScript로 제공한다.

| 기능 | 완료 여부 | 관련 파일 | 비고 또는 제한 |
|---|---|---|---|
| 회원가입·로그인 | 완료 | `server/auth.js`, `server/password-policy.js` | bcrypt 해시, JWT 2시간, 사용자 ID는 토큰에서 복원 |
| 모집글 등록·조회·수정·삭제·취소 | 완료 | `server/app.js`, `server/services/study-service.js` | 활동 이력이 있으면 삭제 409, 모집중·승인 멤버 없음이면 취소 가능 |
| 지원·지원 취소·재지원 | 완료 | `server/services/study-service.js` | 취소 상태 행을 재사용; 거절·승인 후 재지원은 불가 |
| 승인·거절·정원 검사 | 완료 | `server/services/study-service.js` | 트랜잭션·최신 정원 재확인; 마지막 자리 승인 시 `CLOSED/FULL` 자동 마감 |
| 멤버 탈퇴 | 완료 | `server/services/study-service.js` | 지원 상태·멤버십·작업 담당자를 트랜잭션 처리 |
| 스터디 방 작업 관리 | 완료 | `server/services/study-service.js`, `client/app.js` | 진행 중인 스터디의 3열 보드; `todo → doing → done`; 역할·담당자 규칙 적용 |
| 진행률 표시 | 완료 | `server/services/study-service.js` | `done / 전체`; 작업 0개는 0%, 보관된 완료 작업 포함 |
| 새로고침·서버 재시작 후 데이터 유지 | 완료 | `server/db/index.js`, JCloud 설정 | 파일 기반 SQLite; 재시작 후 데모 데이터 유지 확인 |

관리자 화면, 채팅, 알림, 외부 결제, 댓글, 차트는 범위를 핵심 흐름에 집중하기 위해 구현하지 않았다. 별도 사용자 관리 기능도 범위 밖이다. 목록과 모집글 상세는 비로그인 사용자에게 공개하며, 지원자·멤버·작업 데이터는 권한 검사를 거친다.

## 2. 설계

### 2.1 데이터 모델 (ERD)

```text
USERS 1 ── N STUDIES (owner_id)
USERS 1 ── N APPLICATIONS N ── 1 STUDIES
USERS 1 ── N STUDY_MEMBERS N ── 1 STUDIES
USERS 0 ── N TASKS N ── 1 STUDIES (assignee_id는 NULL 허용)
```

| 테이블 | 주요 컬럼 | 제약조건과 설명 |
|---|---|---|
| `users` | `id, username, display_name, password_hash, created_at` | `username UNIQUE`; 비밀번호 bcrypt 해시만 저장 |
| `studies` | `id, owner_id, title, description, capacity, deadline, status, close_reason, created_at` | 정원 1~100; 상태·마감 사유 CHECK; 스터디장은 정원에 미포함 |
| `applications` | `id, study_id, user_id, status, message, decided_by, decided_at, created_at` | `UNIQUE(study_id,user_id)`; 취소 후 재지원은 기존 행을 대기로 복구 |
| `study_members` | `study_id, user_id, joined_at` | 복합 기본키; 승인된 멤버 수로 정원 계산 |
| `tasks` | `id, study_id, title, description, assignee_id, status, due_date, archived, created_at` | 상태 CHECK; 담당자 NULL은 멤버 탈퇴 후 미배정 의미 |

스키마 정의와 이전 DB를 위한 컬럼 추가·작업 담당자 nullable 마이그레이션은 `server/db/schema.js`에 있다. 정원 숫자를 별도 중복 저장하지 않고 `study_members`를 세어 승인과 정원 값의 불일치 가능성을 줄였다.

### 2.2 업무 규칙과 구현 위치

| 규칙 | 내용 | 구현 위치 |
|---|---|---|
| R1 신원 | 사용자 ID는 요청 본문이 아니라 JWT subject에서 가져온다 | `server/auth.js` `middleware`; `server/app.js` |
| R2 권한 | 승인·거절·상태 변경·수정·삭제는 소유자, 지원 취소는 본인, 작업은 멤버 기준 | `server/services/study-service.js` `owner`, `member`; `server/app.js` |
| R3 중복 | 스터디별 사용자 지원 1건; 취소 상태만 재지원 허용 | 서비스 `apply`; DB UNIQUE |
| R4 모집글 상태 | 모집중→마감→진행중→종료; 모집중→취소. 정원·KST 기간 만료는 자동 마감 | 서비스 `STUDY_TRANSITIONS`, 저장소 `closeExpiredStudy(ies)` |
| R5 지원서 상태 | 대기→승인·거절·취소; 승인→탈퇴; 취소→대기 재지원 | 서비스 `apply`, `decide`, `withdrawApplication` |
| R6 정원 | 승인 시 트랜잭션 안에서 현재 멤버 수와 정원 재확인 | 서비스 `decide`, `BEGIN IMMEDIATE` |
| R7 삭제 정책 | 지원서 또는 멤버 이력이 있으면 삭제 거절; 삭제 대신 취소 가능 여부 안내 | 서비스 `deleteStudy`, `changeStudyStatus` |
| R8 작업 상태 | todo→doing→done만 허용; todo만 삭제, 나머지는 보관 | 서비스 `updateTask`, `deleteTask` |
| R9 원자성 | 승인·정원 자동 마감, 모집글 취소·시작, 멤버 탈퇴를 단일 트랜잭션 처리 | 서비스 `tx`, `decide`, `changeStudyStatus`, `leaveStudy` |
| R10 마감 사유·날짜 | `FULL/DEADLINE/MANUAL`; 마감일 당일 23:59:59 KST까지 유효; 멤버 탈퇴 후 자동 재개하지 않음 | `studies.close_reason`, `server/kst-date.js`, 저장소 만료 갱신 |

### 2.3 상태전이도

```text
모집글: 모집중 --정원 충족(FULL) / 다음 KST 날짜(DEADLINE) / 스터디장 수동 마감(MANUAL)--> 마감
        마감 --스터디장 시작/승인 멤버 1명 이상--> 진행중 --스터디장 종료--> 종료
        모집중 --스터디장 취소/승인 멤버 없음--> 취소
        종료·취소에서는 추가 변경 불가
        시작 때 남은 대기 지원은 REJECTED로 일괄 변경

지원서: 대기 --스터디장 승인/정원 여유--> 승인 --멤버 본인 탈퇴--> 탈퇴
        대기 --스터디장 거절--> 거절 | 대기 --지원자 취소--> 취소 --모집 중 재지원--> 대기

작업: 진행중 스터디에서 todo --> doing --> done (건너뛰기와 역방향은 거절; doing/done 삭제는 보관)
```

전이는 `server/services/study-service.js` 서비스 계층에서 검사한다. 요청 경로와 ID 형식은 `server/app.js`, 토큰 검증은 `server/auth.js`에서 처리한다. 실패는 입력 400, 인증 401, 권한 403, 존재하지 않는 자원 404, 상태·중복 충돌 409로 JSON `{code,message}`에 담긴다.

### 2.4 주요 API

| 메서드·경로 | 역할 | 인증 | 권한·상태 조건 | 실패 예 |
|---|---|---|---|---|
| `POST /api/auth/signup`, `/login` | 가입·로그인 | 불필요 | 입력 유효, 로그인 정보 일치 | 400, 409, 401 |
| `GET /api/studies`, `GET /api/studies/:id` | 공개 목록·상세 | 불필요 | 마감일 경과 시 `CLOSED/DEADLINE` 갱신; 없는 ID는 404 | 404 |
| `POST /api/studies`, `PATCH /api/studies/:id` | 등록·수정 | 필요 | 수정은 소유자·모집중·정원 하한 | 400, 403, 409 |
| `PATCH /api/studies/:id/status`, `DELETE /api/studies/:id` | 마감·시작·종료·취소·삭제 | 필요 | 소유자, 정의된 전이; 시작 때 대기 거절; 삭제는 이력 없음 | 403, 409 |
| `POST /api/studies/:id/applications` | 지원 | 필요 | 본인 글 아님·모집중·마감 전·중복 아님 | 403, 409 |
| `PATCH /api/applications/:id/approve`, `/reject` | 승인·거절 | 필요 | 해당 소유자, 대기 상태; 승인 가능한 상태는 모집중, 마지막 자리는 FULL 자동 마감 | 403, 409 |
| `PATCH /api/applications/:id/cancel` | 지원 취소 | 필요 | 지원자 본인, 대기·모집 기간 | 403, 409 |
| `GET /api/me/applications`, `/api/me/studies` | 내 활동 | 필요 | 토큰 사용자 소유 데이터 | 401 |
| `GET /api/studies/:id/participants` | 스터디 참여자·역할·담당 작업 수 | 필요 | 스터디장 또는 멤버 | 401, 403, 404 |
| `GET/POST /api/studies/:id/tasks` | 작업 조회·등록 | 필요 | 소유자 또는 승인 멤버; 생성은 ACTIVE 상태 | 403, 409 |
| `PATCH /api/tasks/:id/status`, `DELETE /api/tasks/:id` | 진행·삭제/보관 | 필요 | 담당자 또는 소유자; ACTIVE·정방향 상태 | 403, 409 |
| `PATCH /api/studies/:id/leave`, `GET /api/studies/:id/progress` | 탈퇴·진행률 | 필요 | 본인 멤버, 작업 접근 멤버 | 403, 409 |

서버는 인증 → 대상 존재 → 권한 → 입력·상태 조건 → 저장 순으로 확인한다. Express 라우트가 인증을 적용하고 서비스 계층이 소유권·상태·정원을 최종 검사한다. 여러 행 변경은 `BEGIN IMMEDIATE`와 COMMIT/ROLLBACK으로 묶는다.

## 3. 구현과 설계 결정

### 3.1 로그인과 인증 확인

파일·함수: `server/auth.js` `signup`, `login`, `middleware`; 정책은 `server/password-policy.js`.

```js
const publicUser=(u)=>({id:u.id,username:u.username,displayName:u.display_name});
return {
  signup(input) {
    const username=String(input?.username||'').trim(),displayName=String(input?.displayName||'').trim(),password=String(input?.password||'');
    if(!/^[a-zA-Z0-9_]{3,30}$/.test(username))throw bad('아이디는 영문·숫자·밑줄 3~30자로 입력해 주세요.');
    if(!displayName||characterCount(displayName)>40||utf8Bytes(displayName)>120)throw bad('이름은 1~40자(UTF-8 기준 120바이트 이하)로 입력해 주세요.');
    const passwordError=passwordPolicyError(username,password);
    if(passwordError)throw bad(passwordError);
```

실제 해시 저장은 `bcrypt.hashSync(password,12)`이며, 로그인 토큰은 HS256·2시간 만료로 발급한다. 성공 응답은 `publicUser`만 포함한다.
가입은 입력 정책을 먼저 검사한 뒤 bcrypt cost 12 해시를 저장한다. 로그인 실패는 계정 없음·비밀번호 오류를 같은 401 메시지로 처리하고, 보호 API는 JWT 서명·issuer·audience·만료를 검사한다. 응답에는 해시가 포함되지 않는다. 비밀번호는 최소 8 코드포인트, 최대 UTF-8 72바이트이며 아이디와 동일한 값 및 일부 흔한 값은 차단한다.

### 3.2 권한 검사

파일·함수: `server/auth.js` middleware, `server/services/study-service.js`의 `owner` 및 `member`.

```js
const owner = (user, study) => {
  if (study.owner_id !== user.id) throw forbidden();
};
const member = (user, studyId) => {
  const s = repo.study(studyId);
  if(!s||(s.owner_id!==user.id&&!repo.isMember(studyId,user.id)))throw forbidden();
};
const withdrawApplication=(user,a)=>{if(!a)throw missing('지원서');if(a.user_id!==user.id)throw forbidden();
  const s=repo.study(a.study_id);if(a.status!=='APPROVED'||['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료 전 승인된 멤버만 탈퇴할 수 있습니다.');
  db.prepare("UPDATE applications SET status='WITHDRAWN',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(a.id);
};
```

401은 유효한 로그인 정보가 없거나 틀렸다는 뜻이고, 403은 로그인은 했지만 해당 데이터 권한이 없다는 뜻이다. 버튼 표시 여부는 사용자 편의일 뿐이므로 서버는 모든 변경 요청에서 다시 소유자·멤버·지원자 본인을 확인한다.

### 3.3 지원과 중복 방지

파일·함수·SQL: `server/services/study-service.js` `apply`; `server/db/schema.js`의 UNIQUE 제약.

```js
const previous = repo.applicationForUserStudy(studyId, user.id);
if (previous) {
  if (previous.status !== 'CANCELLED') throw conflict('이미 지원한 스터디입니다.');
  db.prepare("UPDATE applications SET status='PENDING',message=?,decided_by=NULL,decided_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='CANCELLED'").run(message,previous.id);
  return repo.application(previous.id);
}
try { const r=db.prepare("INSERT INTO applications(study_id,user_id,status,message) VALUES(?,?,'PENDING',?)").run(studyId,user.id,message);
  return repo.application(Number(r.lastInsertRowid)); }
catch(e){if(String(e.message).includes('UNIQUE'))throw conflict('이미 지원한 스터디입니다.');throw e;}
```

지원 전 본인 글 여부, 모집 상태, 마감일, 메시지 길이와 이전 지원 행을 확인한다. 취소된 지원만 같은 행으로 재활성화한다. 서비스 사전 확인은 안내 가능한 충돌 메시지를 주고, DB UNIQUE는 중복 요청이 겹치는 경우에도 행 중복을 막는다. 생성 성공은 201, 권한 위반은 403, 상태·중복은 409다.

### 3.4 승인과 정원 (트랜잭션)

파일·함수: `server/services/study-service.js` `tx`, `decide`.

```js
if (decision === 'approve') {
  if (s.status !== 'RECRUITING') throw conflict('모집이 마감되어 승인을 처리할 수 없습니다.');
  if (repo.memberCount(s.id) >= s.capacity) throw conflict('정원이 모두 찼습니다. 더 이상 승인할 수 없습니다.');
  db.prepare("UPDATE applications SET status='APPROVED',decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").run(user.id,a.id);
  db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(s.id,a.user_id);
  if (repo.memberCount(s.id) >= s.capacity)
    db.prepare("UPDATE studies SET status='CLOSED',close_reason='FULL' WHERE id=? AND status='RECRUITING'").run(s.id);
}
```

실제 코드에서는 `BEGIN IMMEDIATE` 내부에서 지원서·스터디·소유권·대기 상태·모집중 상태·현재 인원을 다시 확인한다. 승인, 멤버 추가, 마지막 자리에서 `CLOSED/FULL` 갱신은 같은 트랜잭션이다. 마감 갱신을 강제 실패시킨 테스트에서 모든 변경이 롤백되었다. KST 날짜가 지난 글은 승인 전에 `CLOSED/DEADLINE`으로 바꾼 뒤 거절한다. 성공은 200, 상태·정원 충돌은 409, 타 스터디장 요청은 403이다.

### 3.5 모집글 취소·삭제와 멤버 탈퇴

파일·함수: `server/services/study-service.js` `deleteStudy`, `changeStudyStatus`, `leaveStudy`.

```js
const tx=(fn)=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}};
changeStudyStatus(user,id,status) {return tx(()=>{const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);
  if(!STUDY_TRANSITIONS[s.status]?.includes(status))throw conflict('허용되지 않은 모집글 상태 변경입니다.');
  if(status==='CANCELLED'&&repo.memberCount(id)>0)throw conflict('승인된 멤버가 있으면 취소할 수 없습니다.');
  if(status==='CANCELLED'||status==='ACTIVE')db.prepare("UPDATE applications SET status='REJECTED',decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE study_id=? AND status='PENDING'").run(user.id,id);
  db.prepare('UPDATE studies SET status=? WHERE id=?').run(status,id);return repo.study(id);});},
leaveStudy(user,studyId) {return tx(()=>{if(!repo.study(studyId))throw missing('스터디');return withdrawApplication(user,repo.applicationForUserStudy(studyId,user.id));});},
```

`deleteStudy`는 소유자만 호출할 수 있고 지원서 또는 멤버 이력이 있으면 409로 거절한다. 취소는 모집중이고 승인 멤버가 없을 때 대기 지원서를 모두 거절한 뒤 글 상태를 취소로 바꾸며, 같은 트랜잭션에 둔다. 멤버 탈퇴도 지원 상태를 `WITHDRAWN`으로 기록하고, 작업 담당자를 NULL로 바꾸고, 멤버십을 지운다. 이를 통해 지원 및 활동 이력을 보존한다.

### 3.6 작업 상태 변경과 진행률

파일·함수: `server/services/study-service.js` `updateTask`, `deleteTask`, `progress`.

```js
const TASK_NEXT = {todo:'doing', doing:'done', done:null};
updateTask(user,id,status) {const t=repo.task(id);if(!t)throw missing('작업');const s=repo.study(t.study_id);member(user,s.id);
  if(user.id!==t.assignee_id&&user.id!==s.owner_id)throw forbidden();
  if(s.status!=='ACTIVE')throw conflict('스터디 진행 중에만 작업 상태를 변경할 수 있습니다.');
  if(TASK_NEXT[t.status]!==status)throw conflict('작업 상태는 todo → doing → done 순서로만 변경할 수 있습니다.');
  db.prepare('UPDATE tasks SET status=? WHERE id=?').run(status,id);return repo.task(id);},
```

작업 상태 변경은 담당자 또는 스터디장만 가능하고 스터디가 `ACTIVE`일 때만 수행한다. 화면은 todo/doing/done 3개 열로 표시하며 참여자별 역할과 담당 중인 미보관 작업 수도 조회한다. 회원은 본인을 담당자로 지정하고 스터디장은 참여자 중 선택할 수 있다. `todo`는 삭제하고 `doing`·`done`은 보관 표시해 이력을 남긴다. 진행률은 전체 작업 중 `done` 개수의 비율이며 작업이 없으면 0%다. 보관 여부와 무관하게 `done`을 포함한다.

### 3.7 재사용 코드와 변경 내역

| 파일·기능 | 출처 | 원래 역할 | 이번 프로젝트 변경·이유 |
|---|---|---|---|
| 서비스 계층·SQLite·오류 처리 | 웹서비스설계 과제 2 `web-service-design-assignment-2` | 수업 과제의 API·신청 도메인 | 구조를 참고해 StudyBoard 용도로 새 작성; 스터디 소유권·정원·지원·멤버십 규칙 추가 |
| 검색·정렬 방어 아이디어 | `week09-board-pagination-practice` | 게시판 목록 검색·정렬 | 허용 정렬 키 화이트리스트 원칙만 참고 |
| `wsd`, `jwt-board-hanip-review` | 코드 재사용 없음 | 참고 대상 저장소 | 구현 파일 복사 없음 |

저장소 URL, 경로, 커밋과 세부 변경은 [`docs/usage-log.md`](usage-log.md)에 기록했다. 이전 과제 저장소는 수정하지 않았다. 기존 게시글 CRUD를 이름만 바꾸지 않고, 업무 상태·정원·소유권·지원 승인 흐름을 새로 구현했다.

## 4. 테스트 결과

실행 환경은 Node.js 24.x, Vitest 5.1.0, Supertest, 메모리 SQLite다. 2026-11-23 작업본에서 `npm test`를 실행해 **39개 모두 통과**했다. 이번 변경은 아직 JCloud에 배포하지 않았으므로 새 코드의 배포 결과로 해석하지 않는다. `npm audit --omit=dev`의 기존 결과는 취약점 0건이다. 아래는 자동화 범위를 기준으로 정리했으며 “미실행”은 실패가 아니라 해당 시나리오를 별도 테스트로 입증하지 않았다는 뜻이다.

### 4.1 정상·인증·권한 (T01–T08)

| ID / 상황 | 준비 상태와 동작 | 예상 결과 | 실제 HTTP·데이터 | 판정 |
|---|---|---|---|---|
| T01 정상 지원·승인 | 회원 지원 후 소유자가 승인 | 지원 저장, 승인과 멤버 추가 | 201 지원, 200 승인; DB 재조회 테스트 통과 | PASS |
| T02 토큰 없음·위조 | 보호 API를 무토큰·위조 토큰으로 요청 | 401, DB 불변 | 401; 스터디 행 0건 확인 | PASS |
| T03 만료 토큰 | 만료 JWT API 요청 | 401 | 2시간 만료 및 검증 구현 확인; 자동 만료 시간 경과 테스트 없음 | 미실행 |
| T04 본문 사용자 ID 위조 | 요청 본문에 다른 user_id/owner_id | 토큰 사용자 기준 저장 | 201, owner_id는 토큰 사용자 ID | PASS |
| T05 본인 글 지원 | 스터디장이 자기 글에 지원 | 403, 지원 행 없음 | 403 확인 | PASS |
| T06 타인 지원 취소 | 다른 회원이 지원 취소 | 403, 상태 유지 | 403 및 상태 불변 검증 | PASS |
| T07 비소유자 승인·비멤버 작업 | 타 스터디장이 승인, 비멤버가 작업 등록 | 403, 기존 값 유지 | 403 확인 | PASS |
| T08 정상 승인 | 대기 지원을 소유자가 승인 | 200, 승인 및 멤버 1명 | 200, 멤버 추가 재조회 | PASS |

### 4.2 입력·상태·중복 (T09–T16)

| ID / 상황 | 준비 상태와 동작 | 예상 결과 | 실제 결과 | 판정 |
|---|---|---|---|---|
| T09 필수값·범위·날짜 | 제목 누락/초과, 정원 0·음수·소수·문자·101, 과거/잘못된 날짜, 소개 초과 | 400, 저장 없음 | 400 JSON; DB 행 0건 확인 | PASS |
| T10 중복 지원 | 같은 사용자가 같은 글에 다시 지원 | 409, 행 하나 | 409; UNIQUE 대상 1행 확인 | PASS |
| T11 승인 연속 재요청 | 동일 승인 API를 연속 두 번 호출 | 첫 요청만 성공 | 200 다음 409; 멤버 한 행 | PASS |
| T12 취소 지원 승인 시도 | 본인 취소 후 승인 시도 | 409, 취소 상태 유지 | 409 및 상태 불변 확인 | PASS |
| T13 취소 후 재지원 | 취소 상태에서 모집 중 재지원 | 기존 행을 대기로 복구 | 201, 같은 ID·PENDING·행 하나 | PASS |
| T14 정원 초과 승인 | 정원 1에 지원 2건, 두 번째 승인 | 409, 대기 유지 | 409 사용자 안내, 승인 멤버 1명 | PASS |
| T15 마감일 경과 승인 | 마감일 지난 대기 건 승인 | 409, 대기 유지 | 409 및 상태 불변 확인 | PASS |
| T16 없는 ID·형식 | 없는 상세/진행률 ID와 잘못된 JSON | 404/400 | 404; JSON 파싱 400 | PASS |

### 4.3 삭제·취소·탈퇴·작업 (T17–T24)

| ID / 상황 | 준비 상태와 동작 | 예상 결과 | 실제 결과 | 판정 |
|---|---|---|---|---|
| T17 이력 있는 글 삭제 | 지원/멤버 이력 있는 글 삭제 | 409, 행 보존 | 409, 글·이력 보존 | PASS |
| T18 이력 없는 글 삭제 | 활동 이력 없는 소유자 글 삭제 | 삭제 성공 | 삭제 성공 테스트 있음 | PASS |
| T19 모집 취소 | 승인 멤버 없이 대기 지원 2건인 글 취소 | 글 취소, 대기 지원 거절 | 200; 양쪽 상태 확인 | PASS |
| T20 승인 멤버 있는 글 취소 | 승인 멤버가 있는 글 취소 | 409, 모든 값 유지 | 409; 글·지원서·멤버 불변 | PASS |
| T21 멤버 탈퇴 | 승인 멤버가 담당 작업이 있는 방 탈퇴 | 멤버 제거, 작업 미배정 | 200; `assignee_id=NULL`, 멤버 0명 | PASS |
| T22 잘못된 작업 전이 | todo→done 및 doing→todo | 409, 상태 유지 | 409; 정상 순방향은 완료 | PASS |
| T23 작업 삭제·보관 | todo 삭제, doing/done 삭제 요청 | todo 제거, 진행 중/완료 보관 | 보관 플래그 확인, done은 진행률 포함 | PASS |
| T24 진행률 경계 | 작업 0개 및 완료 작업 | 0%·100% | 0%, 완료 후 100% | PASS |

### 4.4 자동 마감 추가 검증 (T29–T32)

| ID / 상황 | 준비 상태와 동작 | 예상 결과 | 실제 결과 | 판정 |
|---|---|---|---|---|
| T29 정원 충족 자동 마감 | 모집중·정원 1·대기 지원 1건을 승인 | 승인, 멤버 추가, `CLOSED/FULL` 한 번에 커밋 | 200; DB에서 승인 1건·멤버 1명·`CLOSED/FULL` 재조회. 닫기 UPDATE 오류 주입 시 지원 PENDING·멤버 0·모집중으로 롤백 | PASS |
| T30 KST 마감 시각 | KST 날짜 끝 직전/다음 날짜 시작 시각을 변환하고 지난 날짜 글 상세 조회 | 해당 날짜 23:59:59까지 유효, 다음 날짜 첫 요청에서 `CLOSED/DEADLINE` | UTC 14:59:59는 해당 KST 날짜, 15:00:00은 다음 날; 조회 후 DB 사유 확인 | PASS |
| T31 기간 만료 후 지원 | 과거 마감일의 모집글에 새 회원이 지원 | 409, 자동 마감, 새 지원 행 없음 | 409; DB의 `CLOSED/DEADLINE`, 지원 0건 확인 | PASS |
| T32 이미 마감된 글 수동 마감 | 자동 FULL 마감된 글을 다시 수동 마감 | 409, 원래 마감 사유 보존 | 409; DB의 `CLOSED/FULL` 유지 | PASS |
| 시작 시 대기 지원·역할 목록 | 승인자·대기 지원자가 있는 모집 시작, 참여자 조회 | 대기 지원 거절; OWNER/MEMBER 및 담당 작업 수 표시 | 대기 건 `REJECTED`; 참여자 역할·작업 수 재조회 | PASS |
| 작업 생성 권한·배정 | 모집 마감 전 생성, 회원의 타인 배정, 스터디장의 멤버 배정 | 상태 409, 타인 배정 403, 허용 작업·담당 수 저장 | 응답 코드와 작업 설명·담당 ID·참여자 담당 수 확인 | PASS |

### 4.5 일관성·롤백 (T25–T28)

| ID / 상황 | 준비 상태와 동작 | 예상 결과 | 실제 결과 | 판정 |
|---|---|---|---|---|
| T25 승인 중 멤버 추가 오류 | SQLite trigger로 INSERT 실패 주입 | 500, 지원은 대기, 멤버 0명 | 롤백 후 두 조건을 DB 재조회 | PASS |
| T26 모집 취소 중 오류 | 지원서 일괄 거절 trigger 실패 | 글 모집중·지원 대기 복원 | 상태 양쪽 롤백 확인 | PASS |
| T27 탈퇴 중 오류 | 탈퇴 처리 중 오류 주입 | 세 변경 모두 원복 | 별도 오류 주입 테스트 없음 | 미실행 |
| T28 서버 재시작 | systemd 재시작 후 영속 DB 확인 | 상태·이력 유지 | JCloud 재시작 후 데이터 유지 확인 기록 | PASS (수동) |

추가 자동 검증으로 `Promise.all` 동시 승인, 수정 권한·정원 하한, 시작·종료 순서, 비멤버 조회, 레거시 DB 마이그레이션, 지원 메시지·처리 이력, 시작 시 대기 건 거절, 참여자 역할·담당 작업 수가 있다. `node:sqlite` 동기 API와 단일 프로세스 테스트 환경이므로 `Promise.all`은 다중 프로세스 부하 경합을 입증하지 않는다. 실제 분산 부하 테스트는 하지 않았다.

**거부 사례 상세 (T14):** 정원 1인 모집글에 회원 두 명의 지원서를 준비했다. 첫 지원 승인 후 두 번째 승인 응답은 409 `CONFLICT`와 “정원이 모두 찼습니다. 더 이상 승인할 수 없습니다.”를 반환했다. 테스트는 재조회로 멤버가 1명이고 두 번째 지원이 대기 상태임을 확인한다.

**롤백 증거 (T25):** 멤버 INSERT 전에 실패를 발생시키는 테스트 전용 SQLite trigger를 생성한 뒤 승인 API를 호출했다. 응답은 500이며, 재조회 결과 지원은 `PENDING`, 멤버 행은 0건이었다. trigger는 메모리 테스트 DB에만 존재한다.

## 5. 화면 검증

| ID | 흐름 | 결과와 증거 |
|---|---|---|
| U01 | memberC 지원 → leaderA 승인 → 방 입장 | 서버 API 자동 테스트에서 지원·승인·멤버십 검증 PASS. 최신 사용자 제공 화면 캡처는 미첨부 |
| U02 | 이미 취소된 지원 승인 시도 | 자동 테스트에서 409/상태 유지 확인. 별도 브라우저 캡처 미확인 |
| U03 | 정원 초과 승인 | 자동 테스트에서 서버 409 메시지 확인. 배포 UI 캡처 미확인 |
| U04 | 작업 추가 → doing → done → 진행률, 새로고침 | API 흐름과 진행률 자동 검증 PASS; 배포 브라우저에서 새로고침 시각 증거 미확인 |
| U05 | 멤버 탈퇴 후 미배정 | API 테스트에서 담당자 NULL과 표시 데이터 확인 PASS; 화면 캡처 미첨부 |
| U06 | 서버 재시작 후 데이터 유지 | JCloud에서 재시작 후 DB 유지 확인 기록 있음; 새 캡처는 미첨부 |
| U07 | 마지막 자리를 승인해 정원 자동 마감 | 자동 테스트 T29에서 DB 상태·사유 확인 PASS; 브라우저 캡처 및 새 JCloud 반영은 미확인 |
| U08 | 활성 스터디 방 3열 작업 보드·참여자 역할·담당 작업 수 | API 테스트와 클라이언트 코드 반영; 배포 브라우저와 휴대폰에서 직접 확인 필요 |

브라우저의 실제 화면 검증, Network 탭의 배포 origin 캡처, 모바일 데이터망에서의 전체 기능 확인은 제출 전 추가 증거가 필요하다. 저장소에는 캡처를 임의 생성하거나 실제 확인으로 가장하지 않았다.

## 6. 예외·일관성 정리

| 점검 항목 | 처리 방식 | 확인 테스트 |
|---|---|---|
| 잘못된 입력 | 필드 검증 후 400 `{code,message}`; 잘못된 JSON 400, 16KB 초과 413 | T09, T16 |
| 중복 요청 | 서버 사전 검사 + UNIQUE 제약; 승인은 대기 상태 재확인 | T10, T11, 동시 승인 테스트 |
| 권한 없는 접근 | 401 인증, 403 소유권·멤버십·본인 검사 | T02, T05–T07 |
| 허용되지 않은 상태 변경 | 상태 전이표와 날짜·정원 조건을 서비스 계층에서 검사 | T12, T14–T15, T22 |
| 부분 저장 방지 | 승인·취소·탈퇴를 트랜잭션으로 처리 | T25–T27 |
| 삭제할 수 없는 데이터 | 모집글은 지원·멤버 이력이 있으면 409; 대안으로 조건부 취소; 작업은 todo 삭제 외 보관 | T17–T20, T23 |
| 자동 모집 마감 | 정원 충족은 승인 트랜잭션, 기간 만료는 다음 KST 날짜의 첫 관련 요청에서 닫고 사유 저장 | T29–T32 |

런타임 패키지 감사(`npm audit --omit=dev`)는 0건이다. 전체 개발 도구 감사에는 `picomatch`의 개발 의존성 경로 경고가 남아 있어 `docs/verification.md`에 기록했다. 로그인 반복 시도 제한, 관리자 화면, 알림·채팅·결제는 미구현이다.

## 7. JCloud 배포와 재현

| 항목 | 내용 |
|---|---|
| 배포 주소 | http://s.jedutools.io:40141 |
| 인스턴스·실행 | Ubuntu 24.04, Node.js 24.x, systemd `studyboard.service`, 내부 포트 3000 |
| DB 경로 | `/home/ubuntu/study-recruitment-management/data/studyboard.sqlite` |
| 환경변수 | `PORT`, `JWT_SECRET`, `DB_PATH`, 선택 `DEMO_PASSWORD`; 실제 비밀 값은 저장소에 없음 |
| 재시작 확인 | `/api/health`가 `{"status":"ok"}`; 공개 루트 HTTP 200; 서비스 active |
| 역할 계정·시연 자료 | `leaderA`, `leaderB`, `memberC`; 정원 초과 대기 지원 2건 시연 데이터 준비 |
| 다른 네트워크·모바일 데이터 | 미확인. 제출 전 사용자 실기기에서 확인 필요 |
| 개발자 도구 Network 캡처 | 미첨부. 화면에서 같은 origin 상대경로 `/api/...`를 사용하도록 구현됨 |

새 환경의 기본 절차는 `npm ci` → `.env` 작성 → `npm run db:reset` → `npm start` → `npm test`다. `db:reset`은 데이터베이스 전체를 초기화하므로 기존 운영 데이터가 있는 서버에서 실행하면 안 된다. 운영 데모 상태를 복원할 때는 다른 데이터는 보존하는 `npm run demo:prepare`를 사용한다. 세부 실행 및 systemd 설정은 [`README.md`](../README.md), [`docs/jcloud-deployment.md`](jcloud-deployment.md)에 있다.

## 8. 시연 영상 구성 (1~3분)

영상 촬영은 프로젝트 작성자가 진행한다. 이 보고서 작성 시 영상 URL은 아직 없으므로 미제출이다. LMS에 링크를 제출할 때 공개 권한과 1~3분 길이를 확인한다. 영상에서는 배포 주소의 로그인과 모집·지원·승인·작업 흐름, 정원 초과 또는 권한 거절 사례, 승인 서비스의 트랜잭션 코드 및 DB 결과를 보여줄 계획이다. 상세 촬영 대본은 보고서·저장소에 보관하지 않는다.

## 9. AI 활용과 참고 자료

**AI 사용 여부:** 사용.

| 도구 | 사용 목적 | 반영 범위 | 반영 방식 |
|---|---|---|---|
| Codex (모델 버전 미확인) | 설계 검토, 코드 초안·테스트, 오류 분석, 문서 편집 | 서버 규칙, 화면, 테스트, 보고서 | 제안된 내용을 검토·수정하고 자동 테스트와 배포 상태로 확인 |

**대표 사례:** AI가 bcrypt 입력 길이와 바이트 경계에 주의를 제안했다. bcrypt의 72바이트 제한을 확인해 `password-policy.js`에서 UTF-8 기준 제한을 적용했고, 72바이트 한글 비밀번호의 가입·로그인 및 73바이트 입력 거절 테스트로 검증했다. 비밀번호 구성 문자 강제는 넣지 않고 아이디와 동일한 값 및 작은 흔한 비밀번호 목록을 차단했다.

| 참고 자료 | 반영 위치 | 활용 내용 |
|---|---|---|
| 웹서비스설계 Term Project 안내문 (수업 제공 자료) | 전반 | 필수 요구, 평가 기준, 보고서 구성 반영 |
| OWASP Password Storage Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html | `server/password-policy.js`, 테스트, README | bcrypt 72바이트 한계에 따른 바이트 기준 입력 제한 |
| `web-service-design-assignment-2` | `docs/usage-log.md` | 계층 구조·오류 응답·SQLite 트랜잭션 구조를 참고하고 스터디 도메인은 새로 작성 |
| `week09-board-pagination-practice` | `docs/usage-log.md` | 검색·정렬 입력의 화이트리스트 원칙 참고 |

나머지 과제 저장소는 코드 재사용 없이 확인만 했다. 이전 저장소 어느 곳에도 변경을 가하지 않았다. 상세 출처와 변경 기록은 [`docs/usage-log.md`](usage-log.md)에 있다.

## 10. 이해도 확인과 회고

1. **요청 본문의 사용자 ID를 믿으면 어떤 문제가 생기며, 어떻게 막는가?** 다른 사용자의 ID로 권한을 가장할 수 있다. 인증 미들웨어가 JWT를 검증하고 subject에서 사용자 ID를 복원해 요청 객체에 넣으며, 서비스는 그 ID와 소유자·멤버 정보를 비교한다.
2. **버튼을 숨기는 것만으로 충분하지 않은 이유는?** 브라우저 요청은 직접 만들 수 있기 때문이다. 서버의 `owner`, `member`, `decide` 등 서비스 함수가 변경 요청의 권한을 다시 확인한다.
3. **BEGIN IMMEDIATE가 없다면 승인에서 어떤 일이 생길 수 있는가?** 두 요청이 같은 빈자리를 동시에 확인한 뒤 둘 다 멤버를 추가해 정원을 넘길 수 있다. 현재는 쓰기 트랜잭션을 먼저 획득하고 내부에서 정원을 다시 센다. 단, 자동 검증은 단일 프로세스 수준이므로 다중 프로세스 부하 검증은 한계로 남는다.
4. **삭제 대신 취소·보관하는 데이터와 이유는?** 지원·멤버 이력이 있는 모집글은 삭제하지 않고 조건이 되면 취소하며 이력을 보존한다. todo 작업은 삭제 가능하지만 doing·done은 보관한다. 탈퇴 멤버의 작업은 삭제하지 않고 담당자를 비운다.
5. **어려웠던 오류와 해결 과정은?** 승인 단계 중 지원서만 승인되고 멤버 추가는 실패하는 부분 저장 위험을 고려했다. 두 저장을 트랜잭션으로 감싸고 SQLite trigger로 INSERT 오류를 주입해 지원서가 대기로 롤백되고 멤버가 추가되지 않는지 테스트했다.

## 11. 알려진 오류와 제한사항

| 항목 | 발생 조건 | 영향 | 향후 개선 |
|---|---|---|---|
| 화면·배포 캡처 미첨부 | 보고서 편집 시 이미지 파일이 제공되지 않음 | 수동 UI 검증을 문서만으로 입증할 수 없음 | 사용자 캡처를 받아 설명과 함께 LMS 보고서에 추가 |
| 모바일 데이터망 전체 흐름 미확인 | 휴대폰 Wi-Fi를 끈 외부 접속 시연 미실행 | 외부 회선별 접속 여부 미확정 | 제출 전에 모바일망으로 로그인부터 작업까지 확인 |
| 시연 영상 미제출 | 영상 촬영 및 링크 미완료 | 시연 점수 증거 없음 | 1~3분 촬영, 링크 접근 권한 확인 |
| 만료 토큰 시간 경과 테스트 미실행 | 실제 2시간을 기다리는 테스트는 자동화하지 않음 | JWT 만료 설정은 있지만 시계 경계 테스트 근거 제한 | 짧은 TTL 테스트 설정으로 별도 검증 가능 |
| 멤버 탈퇴 롤백 주입 미실행 | 탈퇴 트랜잭션 중 오류 주입 테스트 부재 | 정상 탈퇴 및 담당자 NULL은 확인했으나 전체 롤백은 별도 미검증 | 실패 지점 주입 테스트 추가 |
| FULL 마감 뒤 마지막 멤버 탈퇴 | 정원 마감된 스터디에서 유일한 승인 멤버가 시작 전 탈퇴 | 자동 재개하지 않으므로 남은 멤버가 없어 시작 불가 | 자동 재개·재모집 기능은 범위 밖; 필요한 경우 별도 상태 전이 설계 |
| 동시성 부하 한계 | `node:sqlite` 동기식, 단일 프로세스 `Promise.all` 테스트 | 여러 서버 프로세스·실제 동시 부하를 대표하지 않음 | 다중 프로세스 통합 부하 테스트 수행 |
| 기존 비밀번호 호환성 | 이전 가입 규칙으로 UTF-8 72바이트를 넘긴 bcrypt 입력 | bcrypt 잘림 특성 때문에 전체 기존 입력 로그인이 실패할 수 있음 | 비밀번호 변경·재설정 기능 추가 |
| 로그인 시도 제한 없음 | 같은 계정에 반복 실패 요청 | 무차별 대입 방어가 별도로 없음 | 로그인 속도 제한 도입 |
| 개발 의존성 감사 경고 | 전체 npm audit에서 `picomatch` 경로가 보고됨 | 런타임 의존성은 아니며 `npm audit --omit=dev`는 0건 | 패치 버전이 나오면 업데이트 후 재검증 |

## 12. 제출 전 최종 확인

- [x] JCloud 공개 주소와 health 확인, systemd 서비스 실행
- [x] 2026-11-23 로컬 작업본 자동 테스트 39개 통과 기록
- [x] README에 설치·실행, 환경변수, 초기화, 시연 데이터 복원, 테스트 절차 기재
- [x] `docs/report.md`와 저장소 PDF를 같은 보고서 내용으로 관리
- [x] 이전 과제 코드 참고 범위와 AI 활용·출처 기록
- [ ] 촬영한 영상 링크 및 열람 권한 확인
- [ ] 모바일 데이터망에서 역할별 로그인과 핵심 흐름 확인
- [ ] Network 탭 및 대표 정상·거절 화면 캡처 추가
- [ ] PDF를 최종 LMS 첨부와 대조하고 담당 교수의 저장소 열람 권한 확인
- [ ] 최종 push 후 SHA를 LMS에 복사하고 제출 완료 상태 확인
- [ ] 제출 후 채점 기간 동안 서비스 유지

최종 제출 전 자동 테스트와 보고서의 실제 결과를 다시 확인한다. LMS에 기재할 SHA는 이 보고서 전용 변경을 포함해 마지막으로 push한 커밋에서 복사한다.

이 보고서 편집에서 확인한 내용은 `docs/verification.md`의 테스트 결과와 2026-11-20 JCloud 상태 기록을 사용했다. 브라우저 캡처와 영상 URL은 제공되지 않아 미완료로 표시했다.
