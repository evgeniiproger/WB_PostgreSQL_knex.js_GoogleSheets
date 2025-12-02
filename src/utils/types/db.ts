import { z } from "zod";

export const warehouseDbSchema = z.object({
 warehouseId: z.number(),
 warehouseName: z.string(),
 geoName: z.string().nullable(),
 boxDeliveryLiter: z.number().nullable(), //z.number().refine(val => !Number.isInteger(val), { message: "Должно быть дробное число", }),
 recordTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, {  message: "Неправильный формат времени HH:MM[:SS]"}),
 recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {  message: "Неправильный формат даты YYYY-MM-DD"}),
 hash: z.string(),
  // boxDeliveryBase: z.string(),
  // boxDeliveryCoefExpr: z.string(),
  // boxDeliveryMarketplaceBase: z.string(),
  // boxDeliveryMarketplaceCoefExpr: z.string(),
  // boxDeliveryMarketplaceLiter: z.string(),
  // boxStorageBase: z.string(),
  // boxStorageCoefExpr: z.string(),
  // boxStorageLiter: z.string(),
});

export type WarehouseFromDb = z.infer<typeof warehouseDbSchema>;

export const warehouseInsertSchema = warehouseDbSchema.omit({ warehouseId: true });

export type WarehouseForInsert = z.infer<typeof warehouseInsertSchema>;