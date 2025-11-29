/**
 * @param {import("knex").Knex} knex
 */
export async function seed(knex) {
    const exists = await knex.schema.hasTable("warehouseList");
    if (!exists) {
        console.log("Table warehouseList does not exist — skipping seed");
        return;
    }

    await knex("warehouseList").del();
    await knex("warehouseList").insert(
        {
            warehouseId: "WH001",
            recordDate: "2024-12-31",
            dtNextBox: "2024-12-31",
            dtTillMax: "2024-12-31",
            boxDeliveryBase: 500.0,
            boxDeliveryCoefExpr: 2,
            boxDeliveryLiter: 50.5,
            boxDeliveryMarketplaceBase: 120.0,
            boxDeliveryMarketplaceCoefExpr: 3,
            boxDeliveryMarketplaceLiter: 60.0,
            boxStorageBase: 200.0,
            boxStorageCoefExpr: 4,
            boxStorageLiter: 80.0,
            geoName: "Almaty",
            warehouseName: "Main Warehouse",
        },
    );
}