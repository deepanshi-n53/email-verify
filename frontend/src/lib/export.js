/**
 * src/lib/export.js
 * Export verification results as CSV or XLSX.
 */

/**
 * Build flat row from a result object
 */
function toRow(r) {
  return {
    Email:              r.email,
    Status:             r.status,
    Confidence:         `${r.confidence}%`,
    Reason:             r.reason,
    'Syntax OK':        r.checks?.syntax     ? 'yes' : 'no',
    'MX Records':       r.checks?.mx         ? 'yes' : 'no',
    'SMTP Connect':     r.checks?.smtp       ? 'yes' : 'no',
    'Mailbox Exists':   r.checks?.mailbox    ? 'yes' : 'no',
    'Catch-all':        r.checks?.catchAll   ? 'yes' : 'no',
    'Disposable':       r.checks?.disposable ? 'yes' : 'no',
    'Role-based':       r.checks?.roleBased  ? 'yes' : 'no',
    'Gibberish':        r.checks?.gibberish  ? 'yes' : 'no',
    'Response ms':      r.response_time_ms ?? '',
  };
}

/**
 * Export as CSV (no dependencies)
 */
export function exportCSV(results, filename = 'mailprobe-results.csv') {
  if (!results?.length) return;
  const rows = results.map(toRow);
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines  = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))];
  const blob   = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Export as XLSX (using xlsx library, lazy-loaded)
 */
export async function exportXLSX(results, filename = 'mailprobe-results.xlsx') {
  if (!results?.length) return;
  const XLSX = await import('xlsx');
  const rows = results.map(toRow);
  const ws   = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 36 }, { wch: 10 }, { wch: 12 }, { wch: 48 },
    ...Array(9).fill({ wch: 14 }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parse uploaded CSV/XLSX file → string[]
 */
export async function parseUploadedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    return parseCSVFile(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSXFile(file);
  }
  throw new Error('Unsupported file type. Use CSV, TXT, or XLSX.');
}

async function parseCSVFile(file) {
  const Papa = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.default.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const emails = data.flatMap(row =>
          row.flatMap(cell =>
            (cell || '').split(/[\s,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
          )
        );
        resolve([...new Set(emails)]);
      },
      error: reject,
    });
  });
}

async function parseXLSXFile(file) {
  const XLSX   = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: 'array' });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const data   = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const emails = data.flatMap(row =>
    (row || []).flatMap(cell =>
      String(cell || '').split(/[\s,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
    )
  );
  return [...new Set(emails)];
}
