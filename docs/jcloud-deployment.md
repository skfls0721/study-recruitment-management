# JCloud 배포 기록

## 현재 배포

2026-11-12 사용자가 확인한 인스턴스는 `202323035`이며 Ubuntu 24.04, `micro` 사양입니다. 앱은 systemd의 `studyboard.service`로 실행하고 내부 포트 3000을 사용합니다. JCloud 세부 정보에 표시된 공개 포트 매핑은 `s.jedutools.io:40141` → 내부 3000입니다. 유동 IP 할당은 계정 정책에서 거절되어 사용하지 않습니다.

- 공개 URL: <http://s.jedutools.io:40141>
- 상태 확인: `curl http://127.0.0.1:3000/api/health` → `{"status":"ok"}`
- 서비스: `studyboard.service` 활성 상태 확인
- 사용자 수동 확인: 공개 화면 표시 및 로그인 성공

SSH 접속 키는 사용자 기기에만 보관합니다. 개인 키 내용은 저장소·문서·채팅에 기록하지 않습니다.

## 배포 절차

인스턴스에서 Node.js 24와 npm을 준비한 뒤 저장소를 복제하고 의존성을 설치합니다.

```sh
git clone https://github.com/skfls0721/study-recruitment-management.git
cd study-recruitment-management
npm ci
cp .env.example .env
```

`.env`에 운영용 `JWT_SECRET` 및 DB 경로를 설정하고 파일 권한을 제한합니다. 운영 서비스는 systemd에서 `/usr/bin/node server/server.js`를 실행합니다. 앱은 `0.0.0.0:3000`에서 요청을 받습니다. 외부 주소는 JCloud가 표시한 포트 전달 주소를 사용합니다.

## 데이터와 시연

`npm run db:reset`은 현재 DB 파일을 삭제하고 데모 계정과 스터디를 처음부터 만듭니다. 따라서 운영 DB에는 실행하지 않습니다. 초기 시드에는 정원 1명에 B·C 대기 지원서가 있는 초과 정원 스터디와 라이브 지원용 모집글이 들어 있습니다. 기존 데모 계정이 있는 라이브 DB에는 `npm run db:seed:demo`를 사용합니다. 이 명령은 기존 데이터를 삭제·수정하지 않고 같은 시연 글·지원서도 중복 생성하지 않습니다. 비밀번호는 초기화 명령이 터미널에 표시하며 LMS 제출란에만 기록합니다.

## 남은 제출 확인

- [x] 인스턴스 생성 및 SSH 접속
- [x] 앱 의존성 설치와 systemd 서비스 실행
- [x] 최신 커밋 배포, 서버 자동 테스트 19개 통과, systemd 재시작
- [x] 내부 health 확인
- [x] 공개 주소에서 화면 표시와 로그인 확인
- [ ] 최신 코드 배포 후 다른 네트워크에서 지원→승인→작업 변경 전체 흐름 재확인
- [ ] 시연 캡처·영상 촬영, 테스트 계정·접속 순서 정리
- [ ] 채점 기간 동안 URL과 서비스 유지 여부 최종 확인

JCloud 사용자 안내: <https://jcloud-devops.github.io/user-guide.html>.
