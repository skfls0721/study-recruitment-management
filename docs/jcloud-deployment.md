# JCloud 배포 체크리스트

## JCloud에서 인스턴스 만들기

전북대 JCloud는 JEduTools 통합 로그인을 사용합니다: <https://jcloud.jbnu.ac.kr/dashboard/>. 로그인과 인스턴스 생성은 사용자 계정에서 진행해야 합니다.

수업 안내의 아래 값을 확인한 뒤 인스턴스를 생성합니다.

- 프로젝트 이름
- 이미지(운영체제)
- Flavor
- 수업용 보안 그룹
- 인스턴스의 내부·공인 접속 주소와 SSH 포트

공개 JCloud 사용자 안내는 다음 절차를 설명합니다.

1. 프로젝트에 들어가 SSH 키페어를 만들고 개인 키를 안전하게 내려받습니다. 키를 저장소, 채팅, LMS에 올리지 않습니다.
2. 수업 지정 이미지를 고릅니다. 일반 수업은 볼륨을 사용하지 않는다고 안내되어 있지만, 과목 공지가 다르면 과목 공지를 따릅니다.
3. 수업 지정 Flavor를 고릅니다.
4. `provider` 네트워크를 선택하고 Port는 선택하지 않습니다.
5. 수업용 보안 그룹이 있으면 사용하고, 없으면 안내서에 따라 기본 그룹을 씁니다.
6. 인스턴스가 `Running`이 된 뒤 현재 대시보드에 표시된 SSH 접속 정보를 확인합니다.

공개 사용자 안내의 SSH 주소와 포트 예시는 2019년 자료입니다. 수업 공지와 현재 대시보드의 접속 정보를 우선 확인하세요. Ubuntu 이미지의 SSH 사용자 이름은 보통 `ubuntu`로 안내되어 있습니다. SSH 개인 키는 본인 기기에만 둡니다.

참고: [JCloud 사용자 안내](https://jcloud-devops.github.io/user-guide.html), [인스턴스 생성 슬라이드](https://jcloud-devops.github.io/files/jcloud.creating.instance.student.2019.pdf), [SSH CLI 슬라이드](https://jcloud-devops.github.io/files/jcloud.ssh.linux.cli.pdf).

## 인스턴스에서 StudyBoard 실행

인스턴스에 접속한 뒤, 수업에서 제공한 운영체제·네트워크 설정과 JCloud 정책을 따릅니다. 현재 프로젝트는 Node.js 24, SQLite 파일, Express 포트 3000을 사용합니다.

```sh
git clone https://github.com/skfls0721/study-recruitment-management.git studyboard
cd studyboard
npm ci
cp .env.example .env
```

`.env`에 운영용 `JWT_SECRET`을 설정하고 파일 권한을 사용자 전용으로 제한합니다. SQLite 파일은 인스턴스 재시작 뒤에도 유지되는 저장 경로인지 확인합니다. 데모 데이터를 준비할 때 `npm run db:reset`을 실행하면 현재 데이터베이스 파일이 삭제된 뒤 데모 계정과 스터디가 다시 만들어지며, 생성된 공통 비밀번호가 터미널에 표시됩니다. 표시된 로그인 정보는 LMS에만 제출합니다.

로컬 확인은 다음과 같습니다.

```sh
npm test
npm run db:reset
npm start
```

앱은 `0.0.0.0:3000`에서 요청을 받습니다. JCloud 보안 그룹과 인스턴스 방화벽에서 외부 접속을 허용하는 포트는 과목 안내 및 수업 정책에 맞춰야 합니다. 현재 앱에는 TLS 종료 프록시 설정이 포함되어 있지 않습니다. 외부 기기에서 실제 로그인·지원·승인·작업 변경이 확인되기 전에는 배포 완료로 기록하지 않습니다.

## 현재 남은 확인

- [ ] 수업 지정 프로젝트·이미지·Flavor·보안 그룹
- [ ] 인스턴스 생성 및 SSH 접속
- [ ] 공개 접속 포트·URL, 데이터베이스 영속성
- [ ] 인스턴스에서 `npm ci`, `npm test`, 서비스 실행
- [ ] 다른 네트워크 기기에서 핵심 흐름 확인
- [ ] 화면 캡처, 테스트 계정과 접속 순서 기록
