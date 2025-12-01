import { google } from "googleapis";
import env from "#config/env/env.js";

const auth = new google.auth.GoogleAuth({
  keyFile: env.SERVICE_ACCOUNT_JSON,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = env.SPREADSHEET_ID;

export const Sheets = {
  insertRows: async (count: number) =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: { sheetId: 0, dimension: "ROWS", startIndex: 0, endIndex: count },
            },
          },
        ],
      },
    }),

  deleteRows: async (count: number) =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId: 0, dimension: "ROWS", startIndex: 0, endIndex: count },
            },
          },
        ],
      },
    }),

  write: async (values, range = "Лист1!A1") =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    }),
    
  getRowCount: async (range = "Лист1!A:G") => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return res.data.values?.length || 0;
  },
};
