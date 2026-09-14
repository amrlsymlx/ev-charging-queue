import { Platform } from "react-native";

// Log fields (actor_name, action details, etc.) come from user-entered data
// with no restriction on content — embedding it into HTML for expo-print's
// WebView-based renderer without escaping would let a customer's name like
// `<img src=x onerror=alert(1)>` execute as markup/script inside the PDF
// render pass. Escape every value before interpolating it into the table.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(
  title: string,
  columns: string[],
  rows: (string | number)[][],
): string {
  const headerCells = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(String(cell))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 16px; }
          h1 { font-size: 16px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; word-break: break-word; }
          th { background-color: #eee; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

// Renders rows as an HTML table and hands the result to expo-print. Web opens
// the browser print dialog (expo-print's web behavior); native writes a PDF
// to the cache dir and hands it to the OS share sheet, mirroring exportExcel.
export async function exportRowsToPdf(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  fileName: string,
): Promise<void> {
  const html = buildHtml(title, columns, rows);
  const Print = await import("expo-print");

  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const Sharing = await import("expo-sharing");
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: fileName,
    });
  }
}
