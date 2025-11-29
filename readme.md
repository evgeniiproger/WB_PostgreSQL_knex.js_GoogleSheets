# knex.js

## Описание

Все настройки можно найти в файлах:
- compose.yaml
- dockerfile
- package.json
- tsconfig.json
- src/config/env/env.ts
- src/config/knex/knexfile.ts

## Команды:

Запуск базы данных:
```bash
docker compose up -d --build postgres
```

Для выполнения миграций и сидов не из контейнера:
```bash
npm run knex:dev migrate latest
```

```bash
npm run knex:dev seed run
```
Также можно использовать и остальные команды (`migrate make <name>`,`migrate up`, `migrate down` и т.д.)

Для запуска приложения в режиме разработки:
```bash
npm run dev          //Вот это выполняется без ошибок
```

Запуск проверки самого приложения:
```bash
docker compose up -d --build app
```

Для финальной проверки рекомендую:
```bash
docker compose down --rmi local --volumes
docker compose up --build
```

PS: С наилучшими пожеланиями!

# Для работы с WB, GOOGLE SHEETS:

## API WB
Добавте в .env в переменную WILDBERRIES_KEY=

## API google (кроме WB ключа нам понадобиться доступ к апи гугла):
Перейдите в Google Cloud Console, Создайте проект, Включите Google Sheets API
Создайте Service Account и скачайте JSON с ключом, так же скопируйте API key вашего проекта:
    1)API key вашего проекта
        Добавте в .env в переменную GOOGLE_KEY=
    2)service-account.json  (например: my-project-*****.json)
        Должен быть в корне проекта (его нужно скачать)
        Добавте название файла в .env в переменную SERVICE_ACCOUNT_JSON=
Так же необходимо выбрать таблицу в которую мы будем выгружать наши данные скопировать её айди и вставить в .env в переменную SPREADSHEET_ID= 

## Для запуска вне Docker:
1) проверить .env(значения в бд такие же):
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
APP_PORT=5000
2) Создать бд с названием postgres
3) Консоль (cd проекта)
```bash
-npm run knex:dev -- migrate latest
```
```bash
-npm run dev
```

## Debug:
1) Можно запустить сиды для заполнения БД тестовыми данными
```bash
npm run knex:dev -- seed run
```
2) для заполнения таблиц данными с определенной даты запустить:
функцию updateDailyData() со строками:
```bash 
// const today = new Date().toISOString().split("T")[0];
const today = "2025-11-11" //Debug: заполнение данными по дате 
//today - (передается как query-параметр ?date=2025-11-11 в API запросе)
```

