import { z } from "zod";

export const warehouseSchema = z.object({
  boxDeliveryBase: z.string(), 
  boxDeliveryCoefExpr: z.string(),
  boxDeliveryLiter: z.string(),
  boxDeliveryMarketplaceBase: z.string(),
  boxDeliveryMarketplaceCoefExpr: z.string(),
  boxDeliveryMarketplaceLiter: z.string(),
  boxStorageBase: z.string(),
  boxStorageCoefExpr: z.string(),
  boxStorageLiter: z.string(),
  geoName: z.string(),
  warehouseName: z.string(),
});

export type WarehouseFromApi = z.infer<typeof warehouseSchema>;

export const apiResponseSchema = z.object({
  response: z.object({
    data: z.object({
      dtNextBox: z.string(),
      dtTillMax: z.string(),
      warehouseList: z.array(warehouseSchema),
    }),
  }),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;
