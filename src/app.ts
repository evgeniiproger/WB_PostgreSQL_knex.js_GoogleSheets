import knex from "#postgres/knex.js";
import pg from "pg";
import { hashObject } from "./utils/hash.js";
import { getToday, getTime } from "./utils/dates.js";
import { Sheets } from "./utils/sheets.service.js";
import env from "#config/env/env.js";
import { apiResponseSchema, ApiResponse } from "./utils/types/api.js";
import { warehouseDbSchema, WarehouseFromDb, warehouseInsertSchema, WarehouseForInsert } from "./utils/types/db.js";

const SORTFULL: string = `boxDeliveryLiter`; //Параметр сортировки таблиц в Google Sheets

console.log("START");
// Отключаем автоматическое преобразование PostgreSQL DATE в объект JS Date. Не даём драйверу pg добавлять время и смещать дату по часовому поясу. Теперь DATE всегда приходит как обычная строка "YYYY-MM-DD". (Ранее из за этого смещались даты. )
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1083, (value) => value);

async function main() {
    type Row = (string | number | null)[];

    const clean = {
        float: (v: string | null | undefined) => (!v || v === "-" ? null : Number(v.toString().replace(",", "."))),
        int: (v: string | null | undefined) => (!v || v === "-" ? null : parseInt(v, 10)),
        date: (v: string | null | undefined) => (!v || v === "-" ? null : v),
    };

    async function pushWarehouse(warehouse: WarehouseForInsert) {
        try {
            await knex("warehouseList").insert(warehouse);
            console.log("[DB] Inserted.");
        } catch (err) {
            console.error("[DB] Insert error:", err);
        }
    }
    // const res = await fetch(`https://964a3c49-a63b-402f-87c1-0fc8c7067472.mock.pstmn.io/Housess`, {
    //     method: "GET",
    // })

    async function getDataFromApi(today: string): Promise<ApiResponse> {
        try {
            console.log("[API] Fetching...");
            const res = await fetch(`https://common-api.wildberries.ru/api/v1/tariffs/box?date=${today}`, {
                method: "GET",
                headers: {
                    "Authorization": `${env.WILDBERRIES_KEY}`,
                },
            });
            // const resMockData = {
            //         response: {
            //             data: {
            //                 dtNextBox: '',
            //                 dtTillMax: '2025-12-02',
            //                 warehouseList: [
            //                     {
            //                         boxDeliveryBase: "46",
            //                         boxDeliveryCoefExpr: "100",
            //                         boxDeliveryLiter: "2",
            //                         boxDeliveryMarketplaceBase: "-",
            //                         boxDeliveryMarketplaceCoefExpr: "-",
            //                         boxDeliveryMarketplaceLiter: "-",
            //                         boxStorageBase: "0,07",
            //                         boxStorageCoefExpr: "100",
            //                         boxStorageLiter: "0,07",
            //                         geoName: "Местоположение склада",
            //                         warehouseName: "Какой-то склад"
            //                     }
            //                 ]
            //             }
            //         }
            // } satisfies ApiResponse;

            const data = apiResponseSchema.parse(await res.json());
            console.log("[API] OK");
            return data;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async function addDateInSheets(dataDB: any[]) {
        const dailyDataForSheets: Row[] = [
            [dataDB[0]?.recordDate],
            ["", "warehouseId", "warehouseName", "geoName", "boxDeliveryLiter", "recordTime", "recordDate"],
            ...dataDB.map((item) => ["", item.warehouseId, item.warehouseName, item.geoName, item.boxDeliveryLiter, item.recordTime, item.recordDate]),
        ];

        const lengthDataForSheets = dataDB.length + 2;
        console.log(`[SHEETS] Insert ${lengthDataForSheets} rows...`);
        await Sheets.insertRows(lengthDataForSheets);

        console.log("[SHEETS] Writing...");
        await Sheets.write(dailyDataForSheets);
        console.log("[SHEETS] Updated.");
    }
    async function deleteDateInSheets(dataDB: any[]) {
        const numRowsToDelete = dataDB.length + 2;
        console.log(`[SHEETS] Deleting ${numRowsToDelete} rows...`);

        await Sheets.deleteRows(numRowsToDelete);
        console.log("[SHEETS] Deleted.");
    }

    async function updateGoogleSheetsFromDB(allDatesInDB: string[]) {
        console.log("[SHEETS] Full rebuild start...");
        const totalRowsToDelete = await Sheets.getRowCount("Лист1!A:G");
        if (totalRowsToDelete > 0) {
            console.log(`[SHEETS] Clearing ${totalRowsToDelete} rows...`);
            await Sheets.deleteRows(totalRowsToDelete);
        }

        for (const date of allDatesInDB) {
            console.log(`[SHEETS] Add date ${date}...`);
            const dataDB = await knex<WarehouseFromDb>("warehouseList").where("recordDate", date).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);
            const checkedData = dataDB.map((row) => warehouseDbSchema.parse(row));
            await addDateInSheets(checkedData);
        }
        console.log("[SHEETS] Full rebuild done.");
    }
    
    console.log("[MAIN] Start...");
    const allDatesInDB: string[] =  await knex("warehouseList").distinct("recordDate").orderBy("recordDate", "asc").pluck("recordDate");

    await updateGoogleSheetsFromDB(allDatesInDB);

    const today: string = getToday();
    console.log(`[MAIN] Today: ${today}`);
    const dataFromApi: ApiResponse = await getDataFromApi(today);

    if (!allDatesInDB.includes(today)) {
    // «есть ли в БД сегодня» Если нет → вставить → обновить таблицу
        console.log("[MAIN] No data for today — inserting.");

        const warehouseList = dataFromApi.response.data.warehouseList;

        const warehouseListForDb: WarehouseForInsert[] = warehouseList.map((item) => {
            const hash = hashObject({ warehouseName: item.warehouseName, geoName: item.geoName, boxDeliveryLiter: item.boxDeliveryLiter });

            const warehouse: WarehouseForInsert = warehouseInsertSchema.parse({
                warehouseName: item.warehouseName || null,
                geoName: item.geoName || null,
                boxDeliveryLiter: clean.float(item.boxDeliveryLiter),
                recordTime: getTime(),
                recordDate: today,
                hash,
            });
            return warehouse;
        });

        for (const warehouse of warehouseListForDb) {
            await pushWarehouse(warehouse);
        }

        console.log("[MAIN] Inserted new entries for today.");

        const dataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);

        console.log("[SHEETS] Updating...");
        await addDateInSheets(dataDB);

        console.log("[MAIN] Done.");
        return;
    } else {
    // «есть ли в БД сегодня» Если нет(else) → вставить → обновить таблицу
        console.log("[MAIN] Today's data exists — checking changes...");
        let updatedVariable: Boolean = false;

        const dataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);

        const dataAPI: any[] = [];
        dataFromApi?.response?.data?.warehouseList?.forEach((item: any) => {
            dataAPI.push({
                warehouseName: item.warehouseName,
                geoName: item.geoName,
                boxDeliveryLiter: item.boxDeliveryLiter,
            });
        });

        const dbMap = new Map(dataDB.map((item) => [item.warehouseName, item]));
        const apiNames = new Set(dataAPI.map((item) => item.warehouseName));

        // 1. UPDATE + INSERT
        for (const apiItem of dataAPI) {
            if (dbMap.has(apiItem.warehouseName)) {
                // проверяем есть ли такой name в БД (ЕСТЬ)
                const dbItem = dbMap.get(apiItem.warehouseName); // получаем объект из БД по name
                const { warehouseName, geoName, boxDeliveryLiter } = apiItem;
                const hashAPI = hashObject({ warehouseName, geoName, boxDeliveryLiter });

                if (dbItem.hash !== hashAPI) {
                    // проверяем хеши, если значения разные обновляем бд по айди
                    console.log(`[DB] Update id=${dbItem.warehouseId}`);
                    const newWarehouse = {
                        warehouseName: apiItem.warehouseName || null,
                        geoName: apiItem.geoName || null,
                        boxDeliveryLiter: clean.float(apiItem.boxDeliveryLiter),

                        recordTime: getTime(),
                        recordDate: getToday(),

                        hash: hashAPI,
                    };

                    await knex("warehouseList")
                        .where("warehouseId", dbItem.warehouseId)
                        .update(newWarehouse)
                        .catch((err) => {
                            console.error("[DB] Update error:", err);
                        });
                    updatedVariable = true;
                }
            } else {
                // проверяем есть ли такой name в БД (НЕТУ), значит это новый склад, добавляем в БД
                console.log(`[DB] Insert new: ${apiItem.warehouseName}`);
                const { warehouseName, geoName, boxDeliveryLiter } = apiItem;
                const hashAPI = hashObject({ warehouseName, geoName, boxDeliveryLiter });

                const newWarehouse = {
                    warehouseName: apiItem.warehouseName || null,
                    geoName: apiItem.geoName || null,
                    boxDeliveryLiter: clean.float(apiItem.boxDeliveryLiter),

                    recordTime: getTime(),
                    recordDate: getToday(),

                    hash: hashAPI,
                };

                await knex("warehouseList")
                    .insert(newWarehouse)
                    .catch((err) => {
                        console.error("[DB] Insert error:", err);
                    });

                updatedVariable = true;
            }
        }

        // 2. DELETE — всё что есть в DB, но отсутствует в API
        for (let i = dataDB.length - 1; i >= 0; i--) {
            if (!apiNames.has(dataDB[i].warehouseName)) {
                console.log(`[DB] Delete id=${dataDB[i].warehouseId}`);

                await knex("warehouseList")
                    .where("warehouseId", dataDB[i].warehouseId)
                    .del()
                    .catch((err) => {
                        console.error("[DB] Delete error:", err);
                    });

                updatedVariable = true;
            }
        }

        console.log("[MAIN] DB OK");

    // Перерисовываем новый день гугл таблицы (только, если изменяли БД)
    if(updatedVariable){
            console.log("[MAIN] Today's data changed — updating Google Sheets.");
            const updatedDataDB = await knex("warehouseList").where("recordDate", today).orderByRaw(`"${SORTFULL}" ASC NULLS FIRST`);
            await deleteDateInSheets(dataDB);
            await addDateInSheets(updatedDataDB);
            updatedVariable = false;
        } else {
            console.log("[MAIN] Today's data unchanged — Sheets update skipped.");
        }
        console.log("[MAIN] Done.");
    }
}

main();
