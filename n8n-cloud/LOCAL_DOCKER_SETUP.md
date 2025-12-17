# 로컬 n8n Docker Compose 가이드

Cloudflare 터널로 외부 노출하기 전에, 먼저 로컬 환경에 n8n을 Docker Compose로 띄워야 한다. 아래 순서를 따라 하면 일관된 개발 환경을 구성할 수 있다.

## 사전 준비
- Docker Desktop 또는 Docker Engine + Docker Compose v2
- 최소 2GB RAM, 1GB 이상의 디스크 여유 공간
- `n8n-cloud` 디렉터리 내에 `n8n_data/` 폴더 생성 (워크플로우와 설정이 저장됨)

```bash
mkdir -p n8n-cloud/n8n_data
```

## 1. 환경 변수 파일 준비
`.env` 파일을 `n8n-cloud/` 하위에 만든다. 기본 인증을 활성화해 두면 로컬에서도 보안상 안전하다.

```env
# .env
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=change-me
N8N_HOST=localhost
N8N_PORT=5678
WEBHOOK_URL=http://localhost:5678/
GENERIC_TIMEZONE=Asia/Seoul
```

> 비밀번호는 꼭 변경해서 사용하고, 터널을 통해 외부에 노출할 계획이라면 Cloudflare Access와 함께 이중 보호를 걸어두는 것이 좋다.

## 2. docker-compose.yml 작성
아래 예시는 SQLite 기반 단일 컨테이너 구성이며, 볼륨을 통해 `/home/node/.n8n` 데이터를 호스트의 `./n8n_data`로 유지한다.

```yaml
version: "3.8"

services:
  n8n:
    image: n8nio/n8n:1.75.0 # 필요한 버전으로 변경 가능
    ports:
      - "${N8N_PORT:-5678}:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=${N8N_BASIC_AUTH_ACTIVE}
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=${N8N_PORT}
      - WEBHOOK_URL=${WEBHOOK_URL}
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE}
    volumes:
      - ./n8n_data:/home/node/.n8n
    restart: unless-stopped
```

### Postgres 포함 예시 (옵션)
워크플로우 데이터가 많거나 멀티 유저 환경이면 Postgres를 붙여 SQLite를 대체할 수 있다.

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: n8n
      POSTGRES_DB: n8n
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  n8n:
    image: n8nio/n8n:1.75.0
    depends_on:
      - postgres
    ports:
      - "${N8N_PORT:-5678}:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE}
      - N8N_BASIC_AUTH_ACTIVE=${N8N_BASIC_AUTH_ACTIVE}
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=${N8N_PORT}
      - WEBHOOK_URL=${WEBHOOK_URL}
    volumes:
      - ./n8n_data:/home/node/.n8n
    restart: unless-stopped
```

## 3. 컨테이너 실행
```bash
cd n8n-cloud
docker compose up -d      # 백그라운드 실행
docker compose logs -f    # 초기 부팅 로그 확인
```

컨테이너가 올라오면 브라우저에서 `http://localhost:5678`로 접속해 로그인 화면이 보이는지 확인한다. 기본 인증을 꺼뒀다면 최초 세션 생성 화면이 나온다.

## 4. 운영 팁
- **업데이트:** `docker compose pull && docker compose up -d`로 안전하게 버전 업.
- **백업:** `n8n_data` 및 (Postgres 사용 시) `postgres_data` 디렉터리를 주기적으로 백업.
- **외부 노출:** Cloudflare 터널로 엔드포인트를 공개하려면 `README.md`의 “로컬 Docker n8n 노출하기” 섹션을 참고한다.
- **환경별 분리:** `.env.dev`, `.env.prod`처럼 환경별로 파일을 나누고 `docker compose --env-file` 옵션으로 전환 가능.
