# 웹서비스설계 한국어 분반 과제 2

신청 승인 서비스의 업무 규칙과 트랜잭션을 구현하는 개인 과제입니다.

**제출 마감: 2026년 11월 25일 23:59 (한국 시간)**

## 배포 자료

- [과제 안내문](01_과제2_안내문.pdf): 필수 정책, 검증 시나리오, 제출 방법과 평가 기준
- [시작 코드 실행 안내](starter/README.md): Node.js 24.x 설치·실행·테스트 방법
- [보고서 양식](03_보고서_양식.docx): 작성 후 PDF로 제출

## 시작하기

1. 안내문과 `starter/docs/API.md`를 읽습니다.
2. `starter` 폴더에서 `npm ci`, `npm test`, `npm start`를 실행합니다.
3. `starter/src/application-service.js`의 TODO 4개와 트랜잭션 처리를 구현합니다.
4. 필수 테스트 32개와 화면 검증 5개를 수행하고 증거를 보고서에 기록합니다.

처음에는 TODO 기능이 501을 반환하고 필수 테스트 일부가 실패합니다. 기반 테스트 4개는 처음부터 통과해야 합니다.

이 배포본의 필수 기능은 신청·대기 취소·직접 승인·승인 취소·대기열 자동 승급·변경 이력입니다. 이전 시작 코드를 실행했다면 새 코드의 DB 초기화 절차를 따르세요.

## 구현 결과

### 구현 완료 여부

- `starter/src/application-service.js`의 TODO 4개(`apply`, `cancel`, `approve`, `revoke`) 구현 완료
- 모든 상태 변경과 이력 저장을 한 트랜잭션(`BEGIN IMMEDIATE` … `COMMIT`/`ROLLBACK`)으로 처리
- `npm test` **4/4 통과**, `npm run test:assignment` **32/32 통과** (Node v24.22.0)
- 선택 심화 `npm run test:advanced`: 별도 구현 없이 실행만 했으며 1/1 통과

### 변경 파일 (제공 코드 대비)

| 파일 | 내용 |
|---|---|
| `starter/src/application-service.js` | TODO-01~04 구현, 트랜잭션 헬퍼 `inTransaction` 추가 |
| `starter/src/repository.js` | 대기자 선택 함수 `nextPending` 추가(기존 함수는 수정하지 않음) |

검증용으로 추가한 파일: `starter/scripts/collect-evidence.mjs`, `starter/docs/evidence/`(테스트 출력, 코드 발췌, 설계 노트, T01~T32 상세 증거, 변경 파일 목록, 재현 절차). 테스트 파일과 기대값은 변경하지 않았습니다.

### 실행 환경

**Node.js 24.x가 필요합니다.** `starter/.npmrc`의 `engine-strict=true` 때문에 다른 버전에서는 `npm ci`가 거부되고, `npm start`도 버전 검사에서 종료됩니다. 별도 DB 서버는 필요 없습니다(Node 내장 SQLite).

### 설치·실행·초기화

```sh
cd starter
node --version              # v24.x 확인
npm ci                      # 의존성 설치 (package-lock.json 기준)
npm test                    # 기반 테스트 4건
npm run test:assignment     # 필수 테스트 T01~T32
npm start                   # http://127.0.0.1:3000 , 종료는 Ctrl+C
npm run db:reset            # 서버 종료 후 실행, RESET 입력 → DB 초기화
```

- 첫 실행 시 `starter/data/app.sqlite`와 `starter/data/jwt-secret.txt`가 자동 생성됩니다. 두 파일은 `.gitignore`로 저장소에서 제외됩니다.
- 포트가 사용 중이면 `PORT=3001 npm start`로 실행합니다.
- 연습 계정과 화면 검증 절차는 [starter/README.md](starter/README.md)를 참고하세요.
