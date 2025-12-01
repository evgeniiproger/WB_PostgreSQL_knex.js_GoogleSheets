# О работе программы

Работа с таблицами:
    1) При первом запуске актуализируются все данные из бд (стирается весь лист)
    2) Если в бд нет сегоднешнего дня - он добавляется
    3) Если в бд есть сегодняшний день и он не актуален - он переписывается
    4) Если в бд есть сегодняшний день и он актуален - ничего не делаем
    ! Чтобы изменить сортировку в отрисовке Google Sheets, нужно поменять параметр SORTFULL и перезапустить приложение

БД:
    1) Актуальность дня в бд проверяется по warehouseName и hash
    2) Сейчас при удалении записи из бд (например если за час уменьшилось количество складов) его айди не удаляется и при создании нового склада (добавился в тот же день или новый создаёт нов) берется следующийся айди. Сделал так - чтобы не было такого что у новго дня айдишники 93 и 100-170, а 100-171


Api должно:
- не присылать одинаковые записи
- не присылать пустой массив записей



# НАСТРОЙКА ПРИЛОЖЕНИЯ (WB, GOOGLE SHEETS):

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

# Debug:
1) Можно запустить сиды для заполнения БД тестовыми данными
```bash
npm run knex:dev -- seed run
```
2) для тестирования изменения данных на API использовать Postman Mock
в текущий мемент времени вот так выглядит ответ от API на который настроино приложение:
{
    "response": {
        "data": {
            "dtNextBox": "2025-11-28",
            "dtTillMax": "2025-12-01",
            "warehouseList": [
                {
                    "boxDeliveryBase": "46",
                    "boxDeliveryCoefExpr": "100",
                    "boxDeliveryLiter": "14",
                    "boxDeliveryMarketplaceBase": "-",
                    "boxDeliveryMarketplaceCoefExpr": "-",
                    "boxDeliveryMarketplaceLiter": "-",
                    "boxStorageBase": "0,07",
                    "boxStorageCoefExpr": "100",
                    "boxStorageLiter": "0,07",
                    "geoName": "",
                    "warehouseName": "склад 1"
                },
                {
                    "boxDeliveryBase": "89,7",
                    "boxDeliveryCoefExpr": "195",
                    "boxDeliveryLiter": "27,3",
                    "boxDeliveryMarketplaceBase": "89,7",
                    "boxDeliveryMarketplaceCoefExpr": "195",
                    "boxDeliveryMarketplaceLiter": "27,3",
                    "boxStorageBase": "0,1",
                    "boxStorageCoefExpr": "145",
                    "boxStorageLiter": "0,1",
                    "geoName": "Центральный федеральный округ",
                    "warehouseName": "склад 2"
                },
                {Тут warehouse},
                {Тут warehouse},
                {Тут warehouse}
            ]
        }
    }
}



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
