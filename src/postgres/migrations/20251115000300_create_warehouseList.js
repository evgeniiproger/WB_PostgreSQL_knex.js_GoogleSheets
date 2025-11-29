/**
 * @param {import("knex").Knex} knex
 */
export async function up(knex) {
    return knex.schema.createTable("warehouseList", (table) => {
        table.increments("warehouseId").primary();
        
        table.string("warehouseName");
        table.string("geoName");
        table.float("boxDeliveryLiter");
        
        table.time("recordTime");
        table.date("recordDate");
        
        table.string("hash");
    });
}

/**
 * @param {import("knex").Knex} knex
 */
export async function down(knex) {
    return knex.schema.dropTableIfExists("warehouseList");
}
