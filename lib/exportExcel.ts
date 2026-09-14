import { Platform } from "react-native";
import * as XLSX from "xlsx";

// Rows here come from customer-entered data (name, plate number, phone
// number) with no restriction on leading characters. Excel/Sheets treats a
// cell starting with =, +, -, @, tab, or CR as a formula — e.g. a customer
// setting their name to `=HYPERLINK("http://evil.example","click")` would
// turn into a live formula the moment a manager opens the exported file.
// Prefixing such values with a leading apostrophe forces spreadsheet apps
// to render them as literal text instead of evaluating them.
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

function sanitizeCell(value: string | number): string | number {
  if (typeof value !== "string") return value;
  // Check the first non-whitespace character — some spreadsheet apps (e.g.
  // Google Sheets, more so than Excel) still evaluate a formula after
  // leading whitespace, so `" =1+1"` needs the same treatment as `"=1+1"`.
  const firstNonWhitespace = value.trimStart()[0];
  return FORMULA_TRIGGER_CHARS.includes(firstNonWhitespace)
    ? `'${value}`
    : value;
}

function sanitizeRow(
  row: Record<string, string | number>,
): Record<string, string | number> {
  const sanitized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeCell(value);
  }
  return sanitized;
}

// Web writes the file straight to a browser download (SheetJS detects the
// DOM and does this itself); native has no filesystem download prompt, so we
// write to a temp file and hand it to the OS share sheet instead.
export async function exportRowsToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string,
): Promise<void> {
  const worksheet = XLSX.utils.json_to_sheet(rows.map(sanitizeRow));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (Platform.OS === "web") {
    XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
    return;
  }

  const [FileSystem, Sharing] = await Promise.all([
    import("expo-file-system/legacy"),
    import("expo-sharing"),
  ]);

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: fileName,
    });
  }
}
