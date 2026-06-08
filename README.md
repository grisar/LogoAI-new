# LogoAI — AI-генератор логотипов

Полнофункциональное веб-приложение для генерации логотипов с помощью искусственного интеллекта. Пользователь выбирает отрасль, стиль, цветовую палитру и задаёт текстовое описание — приложение генерирует 4 уникальных варианта логотипа за ~30 секунд. Результаты можно просматривать, добавлять в избранное, редактировать и экспортировать в PNG, JPG или SVG.

**AI-модель:** [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — FLUX.1 Schnell (`@cf/black-forest-labs/flux-1-schnell`), генерация PNG-изображений по текстовому промпту.

---

## Содержание

- [Архитектура](#архитектура)
- [Функциональность](#функциональность)
- [Стек технологий](#стек-технологий)
- [Структура проекта](#структура-проекта)
- [Быстрый старт (разворачивание с нуля)](#быстрый старт-разворачивание-с-нуля)
- [Ручная установка](#ручная-установка)
- [Конфигурация (.env)](#конфигурация-env)
- [Systemd-сервисы](#systemd-сервисы)
- [API-эндпоинты](#api-эндпоинты)
- [База данных](#база-данных)
- [Генерация логотипов (как это работает)](#генерация-логотипов-как-это-работает)
- [Тарифы и лимиты](#тарифы-и-лимиты)
- [Тестовые аккаунты](#тестовые-аккаунты)
- [Маршруты фронтенда](#маршруты-фронтенда)
- [Безопасность](#безопасность)
- [Мониторинг и логи](#мониторинг-и-логи)
- [Troubleshooting](#troubleshooting)
- [Лицензия](#лицензия)

---

## Архитектура

```
                         +-------------------+
                         |   Браузер (SPA)   |
                         | logoai-frontend   |
                         |   .html :8080     |
                         +--------+----------+
                                  |
                          /api  (reverse proxy)
                          /uploads (static files)
                                  |
+-------------------+    +--------v----------+    +-------------------+
|    PostgreSQL     |    |   Node.js API     |    |  Cloudflare       |
|    :5432          |<-->|   :3000           |--->|  Workers AI       |
|   users, projects |    |   Express + Bull  |    |  FLUX.1 Schnell   |
|   logos, jobs     |    +--------+----------+    +-------------------+
+-------------------+             |
                                  |
                         +--------v----------+
                         |     Redis :6379   |
                         |   Bull Queue      |
                         +-------------------+
```

**Два процесса Node.js:**

1. **logoai-backend** (`index.js`) — REST API на Express, порт 3000. Обрабатывает запросы, управляет БД через Prisma, ставит задачи генерации в очередь Bull.
2. **logoai-frontend** (`static-server.js`) — раздаёт статику на порту 8080 и проксирует `/api/*` на бэкенд (port 3000). Это единая точка входа — CORS не нужен, всё same-origin.

Фронтенд — одностраничное HTML-приложение (SPA), весь UI,路由 и состояние — в одном файле `logoai-frontend.html`.

---

## Функциональность

### Аутентификация
- Регистрация / вход по email + пароль
- JWT-токены (хранятся в `localStorage`)
- Защищённые эндпоинты через `authMiddleware`

### Генерация логотипов
- Выбор отрасли (Технологии, Дизайн, Медицина, Еда, Образование, Финансы, Спорт, Другое)
- Выбор стиля (Минималистичный, Геометрический, Ретро, Современный, Рукописный, Абстрактный)
- Выбор цветовой палитры (6 предустановленных цветов)
- Текстовый промпт (опционально, поддерживает русский язык — автоперевод через MyMemory API)
- Генерация 4 уникальных вариантов параллельно (batch по 2 запроса к Cloudflare)
- Автоповтор при таймауте / NSFW с модифицированным промптом (до 4 раундов)
- Мгновенная остановка при 429 Rate Limit

### Проекты
- Автоматическое создание проекта при генерации
- Список проектов с миниатюрами
- Избранные проекты (toggle)
- Удаление проекта (с модальным подтверждением)

### Редактор логотипов
- Просмотр в полном размере
- Изменение фона (белый, чёрный, прозрачный)
- CSS-фильтры: яркость, контраст, насыщенность
- Поворот, отражение
- Изменение размера холста

### Экспорт
- PNG, JPG, SVG (на стороне клиента через Canvas API)
- SVG встраивает base64-изображение

### Галерея
- Публичная галерея логотипов всех пользователей
- HEAD-проверка URL перед отображением (для устаревших записей)

---

## Стек технологий

| Компонент       | Технология                              |
|-----------------|-----------------------------------------|
| Frontend        | Vanilla JS SPA, одностраничный HTML     |
| Backend API     | Node.js 20, Express 4                   |
| Database        | PostgreSQL 16, Prisma ORM               |
| Queue           | Redis 7, Bull                           |
| AI Model        | Cloudflare Workers AI (FLUX.1 Schnell)  |
| Translation     | MyMemory API (ru→en, бесплатный)        |
| Auth            | JWT (jsonwebtoken), bcrypt              |
| Validation      | Joi                                     |
| HTTP Client     | node-fetch 3                            |
| Process Manager | systemd                                 |
| Proxy           | Node.js http (reverse proxy built-in)   |

---

## Структура проекта

```
/opt/
├── logoai-frontend.html          # Frontend SPA (один файл)
├── welcome.html                  # Welcome-страница
├── deploy/
│   ├── deploy.sh                 # Скрипт полного развёртывания
│   ├── logoai-backend.service    # Systemd юнит бэкенда
│   └── logoai-frontend.service   # Systemd юнит фронтенда
├── logoai-backend/
│   ├── index.js                  # Backend entry point (Express)
│   ├── static-server.js          # Frontend server + reverse proxy
│   ├── package.json              # Зависимости Node.js
│   ├── .env.example              # Шаблон переменных окружения
│   ├── prisma/
│   │   ├── schema.prisma         # Схема БД (User, Project, Logo, GenerationJob)
│   │   └── seed.js               # Тестовые данные (3 пользователя, 5 проектов)
│   ├── uploads/                  # Сгенерированные PNG-логотипы
│   └── src/
│       ├── middleware/
│       │   └── auth.js           # JWT auth + rate limiting по тарифам
│       ├── routes/
│       │   ├── auth.js           # POST /login, /register
│       │   ├── user.js           # GET /me, /subscription
│       │   ├── projects.js       # CRUD проектов
│       │   ├── logos.js          # Генерация + статус + публичная галерея
│       │   └── export.js         # Экспорт логотипов
│       ├── services/
│       │   ├── cloudflare.js     # AI-генерация, перевод, retry-логика
│       │   ├── queue.js          # Bull queue processor
│       │   ├── storage.js        # Сохранение base64 → PNG в /uploads
│       │   └── prisma.js         # Prisma Client singleton
│       └── utils/
│           └── auth.js           # bcrypt хэширование и сравнение паролей
└── README.md
```

---

## Быстрый старт (разворачивание с нуля)

### Требования

- **ОС:** Ubuntu 22.04+ / Debian 12+ (или любой Linux с systemd)
- **RAM:** минимум 1 GB
- **Диск:** минимум 5 GB
- **Доступ:** root или sudo
- **Порты:** 8080 (фронтенд), 3000 (бэкенд, внутренний)

### Установка одной командой

```bash
git clone https://github.com/grisar/LogoAI-new.git /opt
cd /opt
bash deploy/deploy.sh
```

Скрипт автоматически:
1. Установит Node.js 20, PostgreSQL 16, Redis
2. Создаст базу данных `logoai`
3. Установит npm-зависимости
4. Сгенерирует Prisma-клиент и применит схему
5. Засеет БД тестовыми данными
6. Скопирует systemd-юниты и запустит сервисы

### После установки

Отредактируйте `/opt/logoai-backend/.env` — замените секреты:

```bash
nano /opt/logoai-backend/.env
```

Обязательно измените:
- `JWT_SECRET` — сгенерируйте: `openssl rand -base64 32`
- `CF_API_TOKEN` — ваш токен Cloudflare Workers AI
- `CF_ACCOUNT_ID` — ваш Cloudflare Account ID

После изменения `.env`:

```bash
systemctl restart logoai-backend
```

---

## Ручная установка

Если `deploy.sh` не подходит, установите компоненты вручную:

### 1. Системные пакеты

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PostgreSQL 16
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt-get update
apt-get install -y postgresql-16 redis-server

# Запуск
systemctl enable postgresql redis-server
systemctl start postgresql redis-server
```

### 2. База данных

```bash
sudo -u postgres psql -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE logoai OWNER postgres;"
```

### 3. Backend

```bash
cd /opt/logoai-backend
npm install
npx prisma generate
npx prisma db push
npm run seed   # тестовые данные
```

### 4. Конфигурация

```bash
cp .env.example .env
nano .env      # заполнить реальные значения
```

### 5. Systemd

```bash
cp /opt/deploy/logoai-backend.service /etc/systemd/system/
cp /opt/deploy/logoai-frontend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable logoai-backend logoai-frontend
systemctl start logoai-backend
sleep 2
systemctl start logoai-frontend
```

### 6. Проверка

```bash
curl http://localhost:3000/api/auth/login    # 401 — ок, бэкенд работает
curl http://localhost:8080/                   # HTML — фронтенд работает
```

---

## Конфигурация (.env)

Файл: `/opt/logoai-backend/.env` (шаблон — `.env.example`)

| Переменная          | Описание                                      | По умолчанию                                      |
|---------------------|-----------------------------------------------|---------------------------------------------------|
| `API_BASE`          | URL бэкенда (внутренний)                      | `http://0.0.0.0:3000/api`                         |
| `PORT`              | Порт бэкенда                                  | `3000`                                            |
| `HOST`              | Хост бэкенда                                  | `0.0.0.0`                                         |
| `NODE_ENV`          | Режим работы                                  | `production`                                      |
| `JWT_SECRET`        | Секрет для подписи JWT-токенов                | Обязательно изменить                              |
| `DATABASE_URL`      | Строка подключения PostgreSQL                 | `postgresql://postgres:postgres@localhost:5432/logoai?schema=public` |
| `REDIS_URL`         | URL Redis для очереди Bull                    | `redis://localhost:6379`                          |
| `CF_API_TOKEN`      | API токен Cloudflare Workers AI               | Обязательно                                       |
| `CF_ACCOUNT_ID`     | Cloudflare Account ID                         | Обязательно                                       |
| `RATE_LIMIT_FREE`   | Лимит генераций/день (план Free)              | `3`                                               |
| `RATE_LIMIT_BASIC`  | Лимит генераций/день (план Basic)             | `50`                                              |
| `RATE_LIMIT_PRO`    | Лимит генераций/день (план Pro)               | `999999`                                          |
| `CORS_ORIGIN`       | CORS (не нужен при прокси, но `*` для API)    | `*`                                               |
| `FRONTEND_PORT`     | Порт фронтенд-сервера (static-server.js)      | `8080`                                            |

---

## Systemd-сервисы

### logoai-backend.service

| Параметр       | Значение                                      |
|----------------|-----------------------------------------------|
| WorkingDirectory | `/opt/logoai-backend`                       |
| ExecStart      | `/usr/bin/node index.js`                       |
| EnvironmentFile | `/opt/logoai-backend/.env`                    |
| After          | `network.target postgresql.service redis.service` |
| Restart        | `always`, RestartSec=10s                       |

### logoai-frontend.service

| Параметр       | Значение                                      |
|----------------|-----------------------------------------------|
| WorkingDirectory | `/opt/logoai-backend`                       |
| ExecStart      | `/usr/bin/node static-server.js`               |
| Environment    | `FRONTEND_PORT=8080`, `HOST=0.0.0.0`          |
| After          | `network.target logoai-backend.service`        |
| Restart        | `always`, RestartSec=10s                       |

### Команды управления

```bash
systemctl start logoai-backend      # запуск бэкенда
systemctl stop logoai-backend       # остановка
systemctl restart logoai-backend    # перезапуск
systemctl status logoai-backend     # статус

systemctl start logoai-frontend     # запуск фронтенда
systemctl restart logoai-frontend   # перезапуск

journalctl -u logoai-backend -f     # логи бэкенда (live)
journalctl -u logoai-frontend -f    # логи фронтенда (live)
journalctl -u logoai-backend --since "5 min ago"  # логи за 5 минут
```

---

## API-эндпоинты

Все эндпоинты — под префиксом `/api`. При доступе через порт 8080 — проксируются автоматически.

### Аутентификация

| Метод  | Путь                     | Описание             | Auth |
|--------|--------------------------|----------------------|------|
| POST   | `/api/auth/register`     | Регистрация          | Нет  |
| POST   | `/api/auth/login`        | Вход, возвращает JWT | Нет  |

**POST /api/auth/register**
```json
{ "email": "user@example.com", "password": "secret", "name": "User" }
→ { "token": "jwt...", "user": { "id", "email", "plan" } }
```

**POST /api/auth/login**
```json
{ "email": "user@example.com", "password": "secret" }
→ { "token": "jwt...", "user": { "id", "email", "plan" } }
```

### Пользователь

| Метод  | Путь                     | Описание                | Auth |
|--------|--------------------------|-------------------------|------|
| GET    | `/api/user/me`           | Профиль текущего юзера  | Да   |
| GET    | `/api/user/subscription` | Подписка и лимиты       | Да   |

### Проекты

| Метод  | Путь                     | Описание             | Auth |
|--------|--------------------------|----------------------|------|
| GET    | `/api/projects`          | Список проектов      | Да   |
| POST   | `/api/projects`          | Создать проект       | Да   |
| PUT    | `/api/projects/:id`      | Обновить проект      | Да   |
| DELETE | `/api/projects/:id`      | Удалить проект       | Да   |

**POST /api/projects**
```json
{ "name": "MyBrand" }
→ { "project": { "id", "name", "status", ... } }
```

**PUT /api/projects/:id**
```json
{ "name": "NewName", "isFavorite": true }
```

### Логотипы

| Метод  | Путь                                | Описание              | Auth |
|--------|-------------------------------------|-----------------------|------|
| POST   | `/api/logos/generate`               | Запустить генерацию   | Да   |
| GET    | `/api/logos/generate/:jobId/status` | Статус генерации      | Да   |
| GET    | `/api/logos/public`                 | Публичная галерея     | Нет  |
| GET    | `/api/logos/:id`                    | Логотип по ID         | Нет  |

**POST /api/logos/generate**
```json
{
  "projectId": "uuid (optional)",
  "brandName": "MyBrand",
  "industry": "Технологии",
  "style": "Минималистичный",
  "colors": ["#C68DFF"],
  "font": "modern",
  "prompt": "минималистичный логотип для IT-стартапа"
}
→ { "jobId": "uuid" }
```

**GET /api/logos/generate/:jobId/status**
```json
{
  "status": "done",           // pending | processing | done | failed
  "progress": 100,
  "logos": [
    { "id": "uuid", "thumbnailUrl": "/uploads/logo_xxx.png", "brandName": "MyBrand" }
  ],
  "errorMessage": null
}
```

### Экспорт

| Метод  | Путь                     | Описание            | Auth |
|--------|--------------------------|---------------------|------|
| POST   | `/api/export/:logoId`    | Экспорт логотипа    | Да   |

---

## База данных

**PostgreSQL 16**, ORM — Prisma. Схема: `logoai-backend/prisma/schema.prisma`.

### Таблицы

```
users
├── id               UUID (PK)
├── email            VARCHAR(255) UNIQUE
├── passwordHash     TEXT (bcrypt, 12 rounds)
├── name             VARCHAR(100)
├── plan             ENUM: free | basic | pro
├── generationsUsed  INT (счётчик генераций)
├── createdAt        TIMESTAMP
└── updatedAt        TIMESTAMP

projects
├── id               UUID (PK)
├── userId           UUID → users.id (CASCADE DELETE)
├── name             VARCHAR(100)
├── status           ENUM: draft | done
├── isFavorite       BOOLEAN
├── thumbnailUrl     TEXT
├── createdAt        TIMESTAMP
└── updatedAt        TIMESTAMP

logos
├── id               UUID (PK)
├── projectId        UUID → projects.id (CASCADE DELETE)
├── userId           UUID → users.id (CASCADE DELETE)
├── thumbnailUrl     TEXT (/uploads/logo_xxx.png)
├── svgContent       TEXT (всегда null, формат — PNG)
├── bgColor          VARCHAR(20)
├── brandName        VARCHAR(100)
├── style            VARCHAR(50)
├── industry         VARCHAR(50)
├── isPublic         BOOLEAN
├── generationParams JSON
└── createdAt        TIMESTAMP

generation_jobs
├── id               UUID (PK)
├── userId           UUID → users.id
├── projectId        UUID → projects.id
├── status           ENUM: pending | processing | done | failed
├── progress         INT (0–100)
├── params           JSON (параметры генерации)
├── resultLogoIds    STRING[] (массив UUID лого)
├── errorMessage     TEXT
├── createdAt        TIMESTAMP
└── completedAt      TIMESTAMP
```

### Prisma-команды

```bash
cd /opt/logoai-backend
npx prisma generate       # сгенерировать клиент
npx prisma db push        # применить схему к БД
npx prisma studio         # GUI для просмотра данных (порт 5555)
npx prisma migrate reset  # пересоздать БД (DANGER: удаляет данные)
```

---

## Генерация логотипов (как это работает)

### Конвейер

```
Пользователь нажимает "Сгенерировать"
         │
         ▼
POST /api/logos/generate
  → Создаёт Project (если нет projectId)
  → Создаёт GenerationJob (status: pending)
  → Добавляет задачу в Bull Queue
  → Возвращает jobId
         │
         ▼
Frontend поллит GET /api/logos/generate/:jobId/status каждые 2 сек
         │
         ▼
Bull Queue Worker (queue.js):
  1. Проверяет что GenerationJob существует (stale job protection)
  2. Обновляет статус → processing
  3. Вызывает CloudflareService.generateVariations(params, 4)
         │
         ▼
CloudflareService.generateVariations():
  1. Переводит текстовый промпт ru→en (MyMemory API)
     - Сохраняет название бренда от перевода
  2. Строит 4 промпта через buildPrompt()
     - Маппит ru→en: отрасль, стиль, цвет
     - Добавляет "variation N" для вариантов 2–4
     - Суффикс: "minimalist, clean, white background..."
  3. Отправляет batch по 2 параллельных запроса к Cloudflare API
     - Модель: @cf/black-forest-labs/flux-1-schnell
     - Таймаут: 45с на запрос (AbortController)
     - Общий таймаут: 180с
  4. Упавшие запросы → retry (до 4 раундов)
     - Модифицирует промпт (makeSafePrompt): замена trigger-слов + безопасные суффиксы
     - При 429 Rate Limit → мгновенная остановка retry
  5. Возвращает массив успешных результатов
         │
         ▼
Queue Worker (продолжение):
  4. Для каждого результата:
     - Декодирует base64 → PNG
     - Сохраняет в /opt/logoai-backend/uploads/logo_XXX.png
     - Создаёт запись в таблице logos
  5. Обновляет GenerationJob: status=done, resultLogoIds=[...]
  6. Обновляет Project: status=done, thumbnailUrl=первый_лого
  7. Инкрементит user.generationsUsed
         │
         ▼
Frontend получает status=done + массив logos → отображает галерею
```

### Промпт-генерация

Входные данные пользователя (русский):
- Отрасль: `Технологии` → `technology`
- Стиль: `Минималистичный` → `minimalist`
- Цвет: `#C68DFF` → `purple violet`
- Промпт: `логотип для IT-стартапа` → `logo for IT startup` (MyMemory)

Итоговый промпт к Cloudflare:
```
Professional logo design for brand "MyBrand" in technology industry,
minimalist style, using purple violet color palette, logo for IT startup,
minimalist, clean, white background, high quality, professional, vector art,
simple, elegant
```

### Retry при ошибках

- **Таймаут (45с)** — повтор с модифицированным промптом
- **NSFW (код 3030)** — повтор с safe-суффиксом
- **429 Rate Limit** — мгновенная остановка, без retry
- **Максимум 4 раунда retry**, пока не получим 4 логотипа

---

## Тарифы и лимиты

| План    | Генераций/день | Функции                                    |
|---------|----------------|--------------------------------------------|
| Free    | 3              | PNG 72 dpi, 3 проекта                      |
| Basic   | 50             | PNG/JPG 300 dpi, 50 проектов               |
| Pro     | Безлимит       | PNG/JPG/SVG, безлимит проектов, промпты    |

Лимиты настраиваются через переменные окружения `RATE_LIMIT_FREE`, `RATE_LIMIT_BASIC`, `RATE_LIMIT_PRO`.

---

## Тестовые аккаунты

Создаются при `npm run seed`:

| Email              | Пароль       | План  |
|--------------------|--------------|-------|
| test@example.com   | password123  | Free  |
| alex@example.com   | password123  | Basic |
| maria@example.com  | password123  | Pro   |

---

## Маршруты фронтенда

SPA обрабатывает маршрутизацию на стороне клиента:

| Маршрут    | Описание                          |
|------------|-----------------------------------|
| `/`        | Дашборд — список проектов         |
| `/welcome` | Welcome-страница                  |
| (внутренние экраны через show/hide)         |
| `#auth`    | Модальное окно входа/регистрации  |
| `#gen`     | Шаги генерации (отрасль → стиль → цвет → промпт) |
| `#results` | Результаты генерации (4 логотипа) |
| `#editor`  | Редактор выбранного логотипа      |
| `#gallery` | Публичная галерея                 |
| `#favorites` | Избранные проекты               |

---

## Безопасность

- **JWT-авторизация** на всех защищённых эндпоинтах
- **Bcrypt** хэширование паролей (salt rounds: 12)
- **Rate limiting** по тарифам (проверка через `checkPlanRateLimit`)
- **Joi-валидация** всех входящих данных
- **CORS** `*` (не критично — всё через reverse proxy на одном порту)
- **JWT payload** содержит только `{userId, email}` — без чувствительных данных
- **Приватность данных** — пользователи видят только свои проекты и логотипы

---

## Мониторинг и логи

```bash
# Логи бэкенда (live)
journalctl -u logoai-backend -f

# Логи фронтенда (live)
journalctl -u logoai-frontend -f

# Логи за последние 5 минут
journalctl -u logoai-backend --since "5 min ago"

# Поиск ошибок
journalctl -u logoai-backend --since "1 hour ago" | grep -i error

# Статус сервисов
systemctl status logoai-backend logoai-frontend

# Проверка Redis
redis-cli ping

# Проверка PostgreSQL
sudo -u postgres psql -d logoai -c "SELECT COUNT(*) FROM users;"
```

---

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи
journalctl -u logoai-backend -n 50

# Частые причины:
# 1. PostgreSQL не запущен
systemctl start postgresql

# 2. Redis не запущен
systemctl start redis-server

# 3. .env не найден
ls -la /opt/logoai-backend/.env

# 4. Prisma клиент не сгенерирован
cd /opt/logoai-backend && npx prisma generate
```

### 429 Rate Limit при генерации

Cloudflare Workers AI имеет собственные лимиты на количество запросов в минуту. При 429 приложение останавливает retry и показывает уже сгенерированные результаты (если есть).

### Пустой экран на порту 8080

```bash
# Проверить что оба сервиса работают
systemctl status logoai-frontend
curl http://localhost:8080/          # должен вернуть HTML
curl http://localhost:3000/api/auth/login  # должен вернуть 401
```

### Ошибка "Premature close" в логах

Это происходит при таймауте AbortController — нормально для параллельных запросов к Cloudflare. Retry-механизм автоматически перезапускает упавшие запросы.

---

## Лицензия

MIT
