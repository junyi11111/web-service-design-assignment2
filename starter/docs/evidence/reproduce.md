# 실행 재현 명령 (새 폴더 기준)

필요 환경: Node.js **24.x**(`.npmrc`의 `engine-strict=true` 때문에 다른 버전에서는 `npm ci`가 거부됩니다). 확인한 환경은 Node v24.22.0, npm 11.19.1입니다.

```sh
git clone <저장소 URL> assignment2
cd assignment2/starter          # 저장소 구조에 맞게 경로 조정

node --version                  # v24.x 확인
npm ci                          # package-lock.json 기준 설치
npm test                        # 기반 4건 → pass 4, fail 0
npm run test:assignment         # 필수 32건 → pass 32, fail 0

npm start                       # http://127.0.0.1:3000 (data/app.sqlite, data/jwt-secret.txt 자동 생성)
# 다른 터미널에서 확인: curl http://127.0.0.1:3000/api/health  → {"status":"ok"}
# Ctrl+C로 종료

npm run db:reset                # 서버 종료 후 실행, 프롬프트에 RESET 입력
```

포트가 사용 중이면 `PORT=3001 npm start`로 실행합니다. 비대화식으로 초기화하려면 `echo RESET | npm run db:reset`를 사용합니다.

## 재현 확인 기록

2026-11-25에 `node_modules`·`data/`를 뺀 사본을 새 폴더에 만들고 위 절차를 실행했습니다.

- `npm ci`: 성공, found 0 vulnerabilities
- `npm test`: pass 4, fail 0
- `PORT=3917 npm start`: `/api/health` → `{"status":"ok"}`, alice 신청 → `201 Created`, `Location: /api/applications/1`, status PENDING
- 서버 종료 후 `echo RESET | npm run db:reset`: "초기화 완료" 출력, `applications` 0건
