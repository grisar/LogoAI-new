# LogoAI Backend

Backend для AI-генератора логотипов с Cloudflare Workers AI.

## Технологии

- **Node.js** + **Express**
- **PostgreSQL** + **Prisma ORM**
- **Cloudflare Workers AI** (FLUX.1)
- **Bull** + **Redis** (очереди задач)
- **JWT** (авторизация)

## Установка

```bash
npm install
```

## Конфигурация

Скопируйте `.env.example` в `.env` и настройте переменные:

```bash
cp .env.example .env
```

Обязательно задайте:
- `DATABASE_URL` — PostgreSQL соединение
- `REDIS_URL` — Redis для очередей
- `CF_API_TOKEN` — токен Cloudflare
- `CF_ACCOUNT_ID` — ID аккаунта Cloudflare

## База данных

```bash
# Сгенерировать Prisma Client
npm run prisma:generate

# Применить схему к БД
npm run prisma:push

# Откройте Prisma Studio
npm run prisma:studio
```

## Запуск

```bash
# Development
npm run dev

# Production
npm start
```

## API Эндпоинты

### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход

### User
- `GET /api/user/me` — профиль
- `PUT /api/user/me` — обновить профиль
- `GET /api/user/subscription` — подписка и лимиты

### Projects
- `GET /api/projects` — список проектов
- `POST /api/projects` — создать проект
- `PUT /api/projects/:id` — обновить проект
- `DELETE /api/projects/:id` — удалить проект

### Logos
- `GET /api/logos/public` — публичная галерея
- `GET /api/logos/:id` — логотип по ID
- `POST /api/logos/generate` — запустить генерацию
- `GET /api/logos/generate/:jobId/status` — статус генерации

### Export
- `POST /api/export/:logoId` — экспорт логотипа

## Rate Limiting

- **Free**: 3 генерации/день
- **Basic**: 30 генераций/день
- **Pro**: безлимит