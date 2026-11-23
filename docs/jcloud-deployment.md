# JCloud 배포 기록

## 현재 배포

2026-11-23 확인한 인스턴스는 `202323035`이며 Ubuntu 24.04, `micro` 사양입니다. 앱은 systemd의 `studyboard.service`로 실행하고 내부 포트 3000을 사용합니다. 서비스는 `enabled` 및 `active`이며 JCloud의 공개 포트 매핑은 `s.jedutools.io:40141` → 내부 3000입니다. 유동 IP 할당은 계정 정책에서 거절되어 사용하지 않습니다. 서버 Node.js는 24.x입니다.

- 공개 URL: <http://s.jedutools.io:40141>
- 상태 확인: `curl http://127.0.0.1:3000/api/health` → `{"status":"ok"}`
- 서비스: systemd `studyboard.service` enabled/active, 최신 배포 SHA `44dab50bff1e9044f6fdf6cf8e49d4ad5caca4da`
- 코드 검증: 서버 `npm test` 39개 통과; 배포 후 `/api/health` → `{"status":"ok"}` 확인
- 외부 API: 공개 주소에서 health와 세 모집글 조회; 자동 마감 데모 데이터와 소개 문구 확인
- 비밀키: `.env`에서 `JWT_SECRET` 설정 여부 확인(값은 노출하지 않음); 서버 시작 시 미설정이면 종료
- DB: `/home/ubuntu/study-recruitment-management/data/studyboard.sqlite`, 파일 존재 확인. 서비스 재시작 뒤 데모 데이터 유지 확인
- 계정·시연글: `leaderA`, `leaderB`, `memberC`; 정원 1명에 대기 2건, 라이브 모집, 진행 중 작업 보드가 배포 DB에 존재
- 사용자 수동 확인: 이전 공개 화면 표시·로그인은 11/20 확인; 이번 기능 변경 후 브라우저 로그인·화면 캡처는 미확인

SSH 접속 키는 사용자 기기에만 보관합니다. 개인 키 내용은 저장소·문서·채팅에 기록하지 않습니다.

## 배포 절차

인스턴스에서 Node.js 24와 npm을 준비한 뒤 저장소를 복제하고 의존성을 설치합니다.

```sh
git clone https://github.com/skfls0721/study-recruitment-management.git
cd study-recruitment-management
npm ci
cp .env.example .env
```

`.env`에 운영용 `JWT_SECRET` 및 DB 경로를 설정하고 파일 권한을 제한합니다. 서버는 `JWT_SECRET` 없이는 시작하지 않습니다. 운영 서비스는 systemd에서 `/usr/bin/node server/server.js`를 실행합니다. 앱은 `0.0.0.0:3000`에서 요청을 받습니다. 프런트엔드 API는 `/api` 상대 경로를 사용하므로 배포 주소의 같은 origin으로 요청합니다.

## 데이터와 시연

`npm run db:reset`은 현재 DB 파일을 삭제하고 데모 계정과 스터디를 처음부터 만듭니다. 따라서 운영 DB에는 실행하지 않습니다. 기존 데모 계정이 있는 운영 DB에서 시연 데이터를 갱신할 때는 `npm run demo:prepare`를 사용합니다. 이 명령은 세 개의 고정된 시연 모집글과 그 지원서·멤버 관계, 데모 계정 표시 이름을 갱신합니다. 알고리즘 스터디는 진행 중으로 만들고 이름이 정해진 데모 작업 3개만 교체합니다. 다른 사용자·모집글·지원서·멤버십·작업은 유지합니다. 정원 초과 스터디에는 B와 C 두 지원서가 모두 대기 상태입니다. 운영 DB에는 `npm run db:reset`을 실행하지 않습니다.

## 남은 제출 확인

- [x] 인스턴스 생성 및 SSH 접속
- [x] 앱 의존성 설치와 systemd 서비스 실행
- [x] 2026-11-23 최신 코드 배포, 서버 자동 테스트 39개 통과, systemd 재시작
- [x] 내부 health 확인 및 공개 페이지 HTTP 200
- [x] 공개 주소 health와 API 목록·시연 설명 확인; 이번 변경 후 브라우저 로그인 흐름은 미확인
- [ ] 브라우저 390px 폭에서 작업 보드의 모바일 배치·Console 오류 재확인
- [ ] 다른 네트워크에서 모집글 등록→지원→승인→작업 변경 전체 흐름 재확인
- [ ] Network/Console 탭에서 배포 origin 사용과 404·500·CORS 오류 여부 캡처
- [ ] Wi-Fi를 끈 휴대폰에서 공개 페이지 접속 확인
- [ ] 시연 캡처·영상 촬영, 테스트 계정·접속 순서 정리
- [ ] 채점 기간 동안 URL과 서비스 유지 여부 최종 확인

JCloud 사용자 안내: <https://jcloud-devops.github.io/user-guide.html>.
