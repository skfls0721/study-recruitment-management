# StudyBoard

스터디장이 모집글을 등록하고 회원이 지원하면, 스터디장이 정원과 조건을 확인해 승인합니다. 승인된 사용자와 스터디장은 스터디 방에서 작업을 관리하고 진행률을 확인합니다.

## 기술 스택

- Node.js 24, Express 5, SQLite (`node:sqlite`)
- React 대신 가벼운 HTML/CSS/JavaScript 화면을 사용합니다.
- JWT 인증, bcrypt 비밀번호 해시, Vitest + Supertest API 테스트

## 실행

```sh
npm ci
cp .env.example .env
# .env의 JWT_SECRET을 임의의 긴 값으로 변경
npm run db:reset
npm start
```

브라우저에서 `http://localhost:3000`에 접속합니다. 테스트는 `npm test`로 실행합니다. Node.js 24.x가 필요합니다.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `PORT` | HTTP 포트 (기본값 3000) |
| `JWT_SECRET` | JWT 서명 비밀키. 배포 환경에서 반드시 설정 |
| `DB_PATH` | SQLite 파일 경로 (기본값 `./data/studyboard.sqlite`) |
| `DEMO_PASSWORD` | 선택값. 시연용 계정 공통 비밀번호(8~100자). 비우면 초기화 때 무작위 생성 |

## 초기 데이터

`npm run db:reset`은 테스트 계정 3개와 정원 2명 중 1명이 승인된 데모 모집글을 만듭니다. `DEMO_PASSWORD`를 설정하지 않으면 공통 비밀번호를 무작위로 생성해 터미널에 한 번 표시합니다. LMS에는 이 계정 정보를 별도로 제출하세요. 초기화 명령은 기존 SQLite 파일을 삭제하므로 로컬 개발 데이터가 필요한 경우 실행하지 마세요.

## 핵심 규칙

- 로그인은 서버에서 JWT를 확인하고, 사용자 ID는 토큰에서 복원합니다.
- 중복 지원은 서버 검사와 `UNIQUE(study_id,user_id)`로 막습니다.
- 승인은 `BEGIN IMMEDIATE` 트랜잭션 안에서 최신 정원을 확인한 뒤 지원서 승인 및 멤버 추가를 함께 저장합니다.
- 모집글, 지원서, 작업 상태 전이는 서비스 계층에서 검사합니다.
- 작업은 `todo → doing → done`만 허용합니다. 작업이 없으면 진행률은 0%입니다. 보관된 `done` 작업도 계산에 포함합니다.
- 작업 `todo`는 삭제되고 `doing`·`done`은 보관됩니다. 모집글은 지원 이력이 전혀 없을 때만 삭제할 수 있습니다.

## 보고·제출 자료

- 설계 및 규칙: [`docs/design.md`](docs/design.md)
- API 개요: [`docs/API.md`](docs/API.md)
- 보고서 초안: [`docs/report.md`](docs/report.md), [`docs/report.pdf`](docs/report.pdf)
- 이전 과제 재사용·AI 활용 기록: [`docs/usage-log.md`](docs/usage-log.md)
- 테스트와 화면 확인 기록: [`docs/verification.md`](docs/verification.md)
- 전북대 JCloud 배포 체크리스트: [`docs/jcloud-deployment.md`](docs/jcloud-deployment.md)

JCloud 배포, 외부 네트워크 접속, 실제 브라우저 캡처와 시연 영상은 아직 수행되지 않았습니다. 현재 보고서 PDF는 미완료 작업을 표시한 초안이며, 실제 결과를 반영해 갱신해야 합니다.
