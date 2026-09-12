import { Platform } from "react-native";
import * as XLSX from "xlsx";

// Web writes the file straight to a browser download (SheetJS detects the
// DOM and does this itself); native has no filesystem download prompt, so we
// write to a temp file and hand it to the OS share sheet instead.
export async function exportRowsToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string,
): Promise<void> {
  const worksheet = XLSX.utils.json_to_sheet(rows);
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
