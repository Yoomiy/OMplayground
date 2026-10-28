/** Parse comma-separated records, including escaped quotes and quoted newlines. */
export function parseImportCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  function finishCell() {
    row.push(cell.trim());
    cell = "";
    closedQuote = false;
  }

  function finishRow() {
    finishCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
    } else if (char === ",") {
      finishCell();
    } else if (char === "\n" || char === "\r") {
      finishRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else if (char === '"' && !cell.trim() && !closedQuote) {
      cell = "";
      quoted = true;
    } else {
      if (char === '"' || (closedQuote && char.trim())) {
        throw new Error("מרכאות לא תקינות בקובץ CSV");
      }
      cell += char;
    }
  }
  if (quoted) throw new Error("מרכאות לא סגורות בקובץ CSV");
  finishRow();
  return rows;
}
