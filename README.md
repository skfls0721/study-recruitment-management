# StudyBoard

스터디장이 모집글을 등록하고 회원이 지원하면, 스터디장이 정원과 조건을 확인해 승인하며 승인된 멤버는 스터디 방에서 작업을 진행하고 스터디장은 스터디를 종료합니다.

## 기술 스택

- Node.js 24, Express 5, SQLite (`node:sqlite`)
- HTML, CSS, JavaScript 화면
- JWT 인증, bcrypt 비밀번호 해시, Vitest + Supertest API 테스트

## 실행

### 배포된 서비스 검토

JCloud 공개 서비스: [http://s.jedutools.io:40141](http://s.jedutools.io:40141)

아래 명령은 로컬에서 개발하거나 실행할 때 사용하는 방법입니다.

```sh
npm ci
cp .env.example .env
# .env의 JWT_SECRET을 임의의 긴 값으로 변경
npm run db:reset
npm start
```

브라우저에서 `http://localhost:3000`에 접속합니다. 테스트는 `npm test`로 실행합니다. Node.js 24.x가 필요합니다.

## JCloud 배포

현재 공개 주소는 [http://s.jedutools.io:40141](http://s.jedutools.io:40141)입니다. JCloud 인스턴스는 Node.js 24.x에서 systemd `studyboard.service`로 실행하며, 서버 `.env`는 `/home/ubuntu/study-recruitment-management/.env`, 영속 DB는 `/home/ubuntu/study-recruitment-management/data/studyboard.sqlite`입니다. 배포 절차와 상태 기록은 [`docs/jcloud-deployment.md`](docs/jcloud-deployment.md)를 참고하세요.

코드 갱신 후 인스턴스에서 `git pull --ff-only origin main`, `npm ci`, `sudo systemctl restart studyboard`, `curl http://127.0.0.1:3000/api/health` 순서로 확인합니다. 데모 시연 지원이 소진되었을 때만 `npm run demo:prepare`로 예약된 데모 데이터 세 건을 다시 구성합니다. 운영 DB에서는 `npm run db:reset`을 실행하지 않습니다.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `PORT` | HTTP 포트 (기본값 3000) |
| `JWT_SECRET` | JWT 서명 비밀키. 배포 환경에서 반드시 설정 |
| `DB_PATH` | SQLite 파일 경로 (기본값 `./data/studyboard.sqlite`) |
| `DEMO_PASSWORD` | 선택값. 시연용 공통 비밀번호(8자 이상, UTF-8 72바이트 이하, 흔한 비밀번호 제외). 비우면 초기화 때 무작위 생성 |

## 초기 데이터

`npm run db:reset`은 테스트 계정 3개와 한 자리 남은 스터디, 정원 1자리에 대기 지원 2건인 초과 승인 시연 스터디, 라이브 지원 시연용 모집중 스터디를 만듭니다. `DEMO_PASSWORD`를 설정하지 않으면 공통 비밀번호를 무작위로 생성해 터미널에 한 번 표시합니다. LMS에는 이 계정 정보를 별도로 제출하세요. 초기화 명령은 기존 SQLite 파일을 삭제하므로 보존할 데이터가 있을 때 실행하지 마세요.

기존 데모 계정이 준비된 운영 DB의 시연 상태를 다시 맞추려면 `npm run demo:prepare`를 사용합니다. 이 명령은 `leaderA`, `leaderB`, `memberC`의 표시 이름을 지훈·민수·서연으로 맞추고, 이 계정이 소유한 이름이 정해진 시연 모집글 3개의 마감일·상태·지원서·멤버 관계만 다시 구성합니다. 정원 초과 시연 글은 C가 먼저 보이고 B와 C가 모두 대기 상태입니다. 그 외 사용자, 모집글, 지원서, 멤버십, 작업은 건드리지 않습니다. 시연 글 내부의 작업도 유지합니다. 완전히 새 DB가 필요할 때만 `npm run db:reset`을 사용하세요.

## 핵심 규칙

- 로그인은 서버에서 JWT를 확인하고, 사용자 ID는 토큰에서 복원합니다.
- 아이디는 영문·숫자·밑줄 3~30자입니다. 비밀번호는 8자 이상이며 UTF-8 72바이트를 넘을 수 없습니다. 아이디와 같은 비밀번호와 자주 쓰이는 값은 거절합니다. 비밀번호 구성 문자(대문자·숫자·특수문자)를 강제로 요구하지 않습니다.
- 지원서는 스터디·사용자마다 한 행만 유지합니다. 중복 대기·승인·거절 상태는 거절하고, 지원자가 직접 취소한 경우 모집 기간 안에는 같은 행을 다시 대기 상태로 바꿔 재지원할 수 있습니다.
- 승인은 `BEGIN IMMEDIATE` 트랜잭션 안에서 최신 정원을 확인한 뒤 지원서 승인 및 멤버 추가를 함께 저장합니다.
- 스터디장은 모집중인 자기 글만 수정할 수 있고, 정원은 현재 승인 멤버 수보다 작게 줄일 수 없습니다.
- 스터디장은 정원 계산에서 제외하고, 승인 멤버만 `study_members`에 기록합니다. 시작에는 승인 멤버가 한 명 이상 필요합니다.
- 취소는 모집중 상태이며 승인 멤버가 없을 때만 가능합니다. 대기 지원서를 거절 처리하고 모집글을 취소하는 변경은 한 트랜잭션으로 처리합니다.
- 멤버 탈퇴 시 지원 상태 변경, 멤버십 삭제, 해당 멤버 담당 작업의 담당자 비우기를 한 트랜잭션으로 처리합니다.
- 모집글 제목은 최대 100자·UTF-8 300바이트, 정원은 1~100명, 마감일은 오늘 또는 이후의 유효한 날짜여야 합니다.
- 모집글, 지원서, 작업 상태 전이는 서비스 계층에서 검사합니다. 종료·취소된 스터디에서는 작업 등록·상태 변경·삭제·보관을 모두 거절합니다.
- 지원 메시지(최대 500자)와 지원 시각을 보존하며, 승인·거절 처리자와 처리 시각은 스터디장용 지원자 목록에 표시합니다.
- 작업은 `todo → doing → done`만 허용합니다. 작업이 없으면 진행률은 0%입니다. 보관된 `done` 작업도 계산에 포함합니다.
- 입력 길이: 아이디 3~30 ASCII 문자, 표시 이름 40자·UTF-8 120바이트, 비밀번호 최소 8자·최대 UTF-8 72바이트, 모집글 제목 100자·UTF-8 300바이트, 소개 1000자, 작업 제목 120자입니다. 정원은 1~100명입니다.
- 모집글은 지원 이력과 멤버가 모두 없을 때만 삭제할 수 있습니다. 지원 이력이 있으면 삭제하지 않고 취소 규칙을 적용하며, 승인 멤버가 있으면 삭제·취소할 수 없습니다.
- 작업 `todo`는 삭제되고 `doing`·`done`은 보관됩니다. 멤버가 탈퇴하면 작업은 남기고 담당자를 비웁니다.

## 제한사항

- 정원이 가득 차도 모집글 상태를 자동 마감하지 않습니다. 대기 지원서는 유지하고 후속 승인을 거절합니다.
- 거절된 지원서는 다시 지원할 수 없습니다. 본인이 취소한 대기 지원만 모집 기간 중 재지원할 수 있습니다.
- 로그인 반복 횟수 제한은 구현하지 않았습니다.
- 이전 가입 정책(최대 100자)에서 UTF-8 72바이트를 넘긴 비밀번호는 bcrypt 입력 잘림 이력이 있어 새 제한에서 전체 값으로 로그인되지 않을 수 있습니다. 비밀번호 변경·재설정 화면은 구현하지 않았습니다.
- 실행 중 dependency audit은 취약점 0건입니다. 테스트 도구 등 개발 의존성 감사 결과와 한계는 [`docs/verification.md`](docs/verification.md)를 확인하세요.

## 보고·제출 자료

- 설계 및 규칙: [`docs/design.md`](docs/design.md)
- API 개요: [`docs/API.md`](docs/API.md) (`PATCH /api/studies/:id` 모집글 수정 포함)
- 보고서 초안: [`docs/report.md`](docs/report.md), [`docs/report.pdf`](docs/report.pdf)
- 이전 과제 재사용·AI 활용 기록: [`docs/usage-log.md`](docs/usage-log.md)
- 테스트와 화면 확인 기록: [`docs/verification.md`](docs/verification.md)
- 전북대 JCloud 배포 체크리스트: [`docs/jcloud-deployment.md`](docs/jcloud-deployment.md)

JCloud 배포 주소와 현재 확인 결과는 [`docs/jcloud-deployment.md`](docs/jcloud-deployment.md)에 기록했습니다. 최종 제출 전 최신 코드 배포, 외부 네트워크에서 전체 핵심 흐름 재확인, 화면 캡처와 시연 영상을 완료해야 합니다.
