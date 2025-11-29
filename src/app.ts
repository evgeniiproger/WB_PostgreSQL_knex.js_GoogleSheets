import env from "#config/env/env.js";
import knex, { migrate, seed } from "#postgres/knex.js";
import { google } from "googleapis";
import pg from "pg";
import { hashObject } from "./utils/hash.js";
import { getToday, getTime } from "./utils/dates.js";

console.log("START");

// Отключаем автоматическое преобразование PostgreSQL DATE в объект JS Date. Не даём драйверу pg добавлять время и смещать дату по часовому поясу.
// Теперь DATE всегда приходит как обычная строка "YYYY-MM-DD". (Ранее из за этого смещались даты. )
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1083, (value) => value);

// ТУТ НУЖНО УКАЗАТЬ ПАРАМЕТР СОРТИРОВКИ
const SORT = "DeliveryMarketplace"; // Тут выбираем и подставляем: Delivery||DeliveryMarketplace||Storage
// const SORTFULL = `box${SORT}CoefExpr`; // Тут ничего не трогаем! Получиться: boxDeliveryCoefExpr || boxDeliveryMarketplaceCoefExpr || boxStorageCoefExpr
const SORTFULL = `boxDeliveryLiter`; // Тут ничего не трогаем! Получиться: boxDeliveryCoefExpr || boxDeliveryMarketplaceCoefExpr || boxStorageCoefExpr

// await updateDailyData()
// await dbToSheet();
//   Каждый час:
async function main() {
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -------------------------------------------V
    type Row = (string | number | null)[];

    const clean = {
        float: (v: string | null | undefined) => (!v || v === "-" ? null : Number(v.toString().replace(",", "."))),
        int: (v: string | null | undefined) => (!v || v === "-" ? null : parseInt(v, 10)),
        date: (v: string | null | undefined) => (!v || v === "-" ? null : v),
    };

    async function pushWarehouse(warehouse: any) {
        // Асинхронная функция для добавления в БД (для цикла)
        try {
            await knex("warehouseList").insert(warehouse);
        } catch (err) {
            console.error("Error inserting warehouse:", err);
        }
    }

    async function getDataFromApi(today: string) {
        try {
            const res = await fetch(`https://common-api.wildberries.ru/api/v1/tariffs/box?date=${today}`, {
                method: "GET",
                headers: {
                    "Authorization": `${env.WILDBERRIES_KEY}`,
                },
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    function googleAuth() {
        const auth = new google.auth.GoogleAuth({
            keyFile: env.SERVICE_ACCOUNT_JSON, // JSON с сервисного аккаунта, должен быть в корне проекта
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = google.sheets({ version: "v4", auth });
        return sheets;
    }

    async function addDateInSheets(dataDB: any[]) {
        //Функция добавления данных за один день в гугл таблицу
        const sheets = googleAuth();
        const spreadsheetId = env.SPREADSHEET_ID;

        const dailyDataForSheets: Row[] = [
            [dataDB[0].recordDate],
            [
                "",
                "warehouseId", // "warehouseId",

                "warehouseName", // "recordDate",
                "geoName", // "geoName",
                "boxDeliveryLiter", // "boxDeliveryLiter",

                "recordTime", // "recordTime",
                "recordDate", // "recordDate",
            ],
        ];
        dataDB.forEach((item) => {
            dailyDataForSheets.push(["", item.warehouseId, item.warehouseName, item.geoName, item.boxDeliveryLiter, item.recordTime, item.recordDate]);
        });
        const lengthDataForSheets = dataDB.length + 2; // +1 потому что заголовок включен в dailyDataForSheets
        console.log(`aDIS: Длина данных для гугл таблицы: ${lengthDataForSheets} строк...`);
        // ДВИГАЕМ Вставляем новые ПУСТЫЕ строки сверху

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: 0,
                                dimension: "ROWS",
                                startIndex: 0, // начиная с первой строки
                                endIndex: lengthDataForSheets, // на сколько строк вниз сдвинуть (totalRowsToInsert - Итоговое количество строк для вставки)
                            },
                            inheritFromBefore: false,
                        },
                    },
                ],
            },
        });
        console.log(`aDIS: Данные сдвинуты на ${lengthDataForSheets} строк`);
        console.log("aDIS: пишем данные...");
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: "Лист1!A1",
            valueInputOption: "RAW",
            requestBody: { values: dailyDataForSheets },
        });
        console.log("aDIS: записали данные");
    }
    async function deleteDateInSheets(dataDB: any[]) {
        //Функция удаления данных за один день в гугл таблице
        const sheets = googleAuth();
        const spreadsheetId = env.SPREADSHEET_ID;
        const numRowsToDelete = dataDB.length + 2; // +2 на заголовки и дату
        console.log(`Удаляем сверху ${numRowsToDelete} строк`);

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: 0,
                                dimension: "ROWS",
                                startIndex: 0, // начиная с первой строки
                                endIndex: numRowsToDelete, // на сколько строк вниз удалить
                            },
                        },
                    },
                ],
            },
        });
        console.log("Удалили");
    }
    async function updateGoogleSheetsFromDB(allDatesInDB: string[]) {
        console.log("uGSFDB: Начинаем актуализацию Google Sheets...");

        const sheets = googleAuth();
        const spreadsheetId = env.SPREADSHEET_ID;
        console.log("uGSFDB:  Удаляем все строки в гугл таблице...");
        const totalRowsToDelete =
            (
                await sheets.spreadsheets.values.get({
                    // Получаем общее количество строк в таблице
                    spreadsheetId,
                    range: "Лист1!A:G",
                })
            ).data.values?.length || 0;

        if (totalRowsToDelete > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId: 0,
                                    dimension: "ROWS",
                                    startIndex: 0, // начиная с первой строки
                                    endIndex: totalRowsToDelete, // на сколько строк вниз удалить
                                },
                            },
                        },
                    ],
                },
            });
            console.log(`uGSFDB:  Удалено строк: ${totalRowsToDelete}`);
        } else {
            console.log("uGSFDB:  В гугл таблице нет строк для удаления");
        }
        console.log("uGSFDB:  Заполняем Sheets из БД...");

        for (const date of allDatesInDB) {
            console.log(`uGSFDB:   Добавляем дату ${date} в гугл таблицу...`);
            const dataDB = await knex("warehouseList").where("recordDate", date).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);
            await addDateInSheets(dataDB);
            console.log(`uGSFDB:   Дата ${date} добавлена в гугл таблицу`);
        }
        console.log("uGSFDB:  Актуализация Google Sheets завершена.");
    }
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -------------------------------------------^
    const allDatesInDB = await knex("warehouseList").distinct("recordDate").orderBy("recordDate", "asc").pluck("recordDate");
    console.log(`main: Даты в БД: ${allDatesInDB}`);

    // Актуализируем Google Sheets из БД
    await updateGoogleSheetsFromDB(allDatesInDB);

    // Проверяем есть ли в бд сегодня
    // const today = "2025-11-27" //Debug: заполнение старыми
    const today = getToday();
    console.log(`main: Сегодня: ${today}, обновляем данные за сегодня...`);
    const dataFromApi = await getDataFromApi(today);

    // Проверить «есть ли в БД сегодня»
    console.log(`main: Даты в бд: ${allDatesInDB}`);
    // «есть ли в БД сегодня» Если нет → вставить → обновить таблицу
    if (!allDatesInDB.includes(today)) {
        // Если нет → вставить → обновить таблицу
        console.log("Добавляем сегодняшний день - его нет в БД");
        dataFromApi?.response?.data?.warehouseList?.forEach((item: any) => {
            const { warehouseName, geoName, boxDeliveryLiter } = item;
            const hash = hashObject({ warehouseName, geoName, boxDeliveryLiter });

            const warehouse = {
                warehouseName: item.warehouseName || null,
                geoName: item.geoName || null,
                boxDeliveryLiter: clean.float(item.boxDeliveryLiter),

                recordTime: getTime(),
                recordDate: today, //today,

                hash,
            };
            pushWarehouse(warehouse);
        });
        //Обновить таблицу (Сдвигаем что есть вниз, добавляем новые сверху)
        console.log(`Данные за сегодня (${today}) добавлены в бд`);
        //--------------------------------------------------------------
        //Можно заполнять гугл таблицу без отдельного запроса к бд, но мы будем делать запрос к бд
        const dataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);
        // console.log("dataDB: ", dataDB);
        //--------------------------------------------------------------
        console.log("Начинаем обновление гугл таблицы...");
        await addDateInSheets(dataDB);
        console.log("Гугл таблица обновлена, конец");
    } else {
        console.log(`main: Данные в бд за сегодня ${today} есть, начинаем обновление...`);

        //Получаем данные из бд за сегодня
        const dataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);

        // console.log("dataDB: ",dataDB);

        const dataAPI: any[] = [];
        dataFromApi?.response?.data?.warehouseList?.forEach((item: any) => {
            dataAPI.push({
                warehouseName: item.warehouseName,
                geoName: item.geoName,
                boxDeliveryLiter: item.boxDeliveryLiter,
            });
        });

        const dbMap = new Map(dataDB.map((item) => [item.warehouseName, item]));
        //   'Old Name 1' => {
        //     id: 1,
        //     name: 'Old Name 1',...

        const apiNames = new Set(dataAPI.map((item) => item.warehouseName));
        // apiNames: Set(3) { 'Old Name 1', 'Old Name 2', 'Old Name 3' }

        // 1. UPDATE + INSERT
        for (const apiItem of dataAPI) {
            if (dbMap.has(apiItem.warehouseName)) {
                // проверяем есть ли такой name в БД (ЕСТЬ)
                const dbItem = dbMap.get(apiItem.warehouseName); // получаем объект из БД по name
                const { warehouseName, geoName, boxDeliveryLiter } = apiItem;
                const hashAPI = hashObject({ warehouseName, geoName, boxDeliveryLiter }); // считаем хеш для новых данных из АПИ

                if (dbItem.hash !== hashAPI) {
                    // проверяем хеши,
                    // если значения разные
                    console.log(`UPDATE id: ${dbItem.warehouseId}`);
                    const newWarehouse = {
                        warehouseName: apiItem.warehouseName || null,
                        geoName: apiItem.geoName || null,
                        boxDeliveryLiter: clean.float(apiItem.boxDeliveryLiter),

                        recordTime: getTime(),
                        recordDate: getToday(), //today,

                        hash: hashAPI,
                    };
                    console.log(`Обновляем id: ${dbItem.warehouseId} новыми данными: ${JSON.stringify(newWarehouse)}`);
                    await knex("warehouseList")
                        .where("warehouseId", dbItem.warehouseId)
                        .update(newWarehouse)
                        .catch((err) => {
                            console.error("Error updating warehouse:", err);
                        });
                    console.log(`DONE: Обновили id: ${dbItem.warehouseId} новыми данными: ${JSON.stringify(newWarehouse)}`);
                }
            } else {
                // проверяем есть ли такой name в БД (НЕТУ)
                console.log(`НОВАЯ ЗАПИСЬ: ${apiItem.warehouseName}, добавляем в БД`);
                const { warehouseName, geoName, boxDeliveryLiter } = apiItem;
                const hashAPI = hashObject({ warehouseName, geoName, boxDeliveryLiter }); // считаем хеш для новых данных из АПИ

                const newWarehouse = {
                    warehouseName: apiItem.warehouseName || null,
                    geoName: apiItem.geoName || null,
                    boxDeliveryLiter: clean.float(apiItem.boxDeliveryLiter),

                    recordTime: getTime(),
                    recordDate: getToday(), //today,

                    hash: hashAPI,
                };

                await knex("warehouseList")
                    .insert(newWarehouse)
                    .catch((err) => {
                        console.error("Error inserting new warehouse:", err);
                    });
                console.log(`DONE: Вставили новую запись: ${JSON.stringify(newWarehouse)}`);
            }
        }

        // 2. DELETE — всё что есть в DB, но отсутствует в API
        for (let i = dataDB.length - 1; i >= 0; i--) {
            if (!apiNames.has(dataDB[i].warehouseName)) {
                console.log(`Удаляем запись из БД с id: ${dataDB[i].warehouseId}, этого нет в API(удаляем): ${dataDB[i]}`);
                await knex("warehouseList")
                    .where("warehouseId", dataDB[i].warehouseId)
                    .del()
                    .catch((err) => {
                        console.error("Error deleting warehouse:", err);
                    });
                console.log(`DONE: Удалили запись из БД с id: ${dataDB[i].warehouseId}, этого нет в API(удаляем): ${dataDB[i]}`);
            }
        }

        console.log("main: Бд актуальна за сегодня");

        // Тут перерисовываем новый день гугл таблицы
        console.log("main: Начинаем актуализацию Google Sheets...");
        const updatedDataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);
        await deleteDateInSheets(dataDB);
        await addDateInSheets(updatedDataDB);

        console.log("main:  Актуализация Google Sheets завершена.");
    }
}

main();
