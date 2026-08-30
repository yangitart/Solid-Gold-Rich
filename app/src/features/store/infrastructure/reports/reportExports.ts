import { productStock, storeReportData } from '@/features/store/domain/services/storeDomain';
import type { ReportExportLabels, StoreReportRange, StoreReportSource } from '@/features/store/application/ports/ReportRepository';

export type { ReportExportLabels, StoreReportRange } from '@/features/store/application/ports/ReportRepository';

type Sheet = { name: string; rows: (string | number)[][] };

function amount(value: number, currency: string, language: string) {
  return `${value.toLocaleString(language, { maximumFractionDigits: 2 })} ${currency}`;
}

function dateLabel(value: string, language: string) {
  return new Date(value).toLocaleDateString(language);
}

function localDayTimestamp(value: string) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function filterStoreReportState<T extends StoreReportSource>(state: T, range?: StoreReportRange): T {
  if (!range?.start || !range.end) return state;
  const start = localDayTimestamp(range.start);
  const end = localDayTimestamp(range.end);
  return {
    ...state,
    store: {
      ...state.store,
      sales: state.store.sales.filter((sale) => {
        const date = localDayTimestamp(sale.date);
        return date >= start && date <= end;
      }),
      cashMovements: state.store.cashMovements.filter((movement) => {
        const date = localDayTimestamp(movement.date);
        return date >= start && date <= end;
      }),
    },
  };
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function sheetsFor(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange): Sheet[] {
  const report = storeReportData(state);
  const movements = state.store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date));
  const products = state.store.products.slice().sort((left, right) => left.name.localeCompare(right.name));
  const employees = state.store.employees.slice().sort((left, right) => left.name.localeCompare(right.name));
  const clients = state.store.clients.slice().sort((left, right) => left.name.localeCompare(right.name));
  const inventory = products.map((product) => [product.key, product.name, product.type, productStock(state, product.id), Math.max(0, productStock(state, product.id) - product.reservedQuantity), amount(product.salePrice, currency, language)] as (string | number)[]);
  return [
    { name: labels.summary, rows: [[labels.title, state.store.name], [labels.generated, dateLabel(new Date().toISOString(), language)], ...(range ? [[labels.period, range.label] as (string | number)[]] : []), [labels.balance, amount(state.store.businessAccount.balance, currency, language)], [labels.transactions, report.sales.length], [labels.amount, amount(report.total, currency, language)]] },
    { name: labels.salesByDay, rows: [[labels.date, labels.transactions, labels.amount], ...report.daily.map(([date, value]) => [date, value.count, amount(value.total, currency, language)])] },
    { name: labels.topProducts, rows: [[labels.name, labels.quantity, labels.amount], ...report.topProducts.map(([, value]) => [value.name, value.quantity, amount(value.total, currency, language)])] },
    { name: labels.topClients, rows: [[labels.name, labels.transactions, labels.amount], ...report.topClients.map(([id, value]) => [state.store.clients.find((client) => client.id === id)?.name ?? id, value.count, amount(value.total, currency, language)])] },
    { name: labels.moneyMovements, rows: [[labels.date, labels.type, labels.name, labels.amount], ...movements.map((movement) => [dateLabel(movement.date, language), movement.type, movement.note, amount(movement.amount, currency, language)])] },
    { name: labels.inventory, rows: [[labels.type, labels.name, labels.stock, labels.available, labels.salePrice], ...inventory.map((row) => [row[0], row[1], row[3], row[4], row[5]])] },
    { name: labels.employees, rows: [[labels.name, labels.role, labels.contact, labels.amount, labels.status], ...employees.map((employee) => [employee.name, employee.role ?? '', employee.phone ?? '', amount(employee.salary, currency, language), employee.active ? labels.active : labels.inactive])] },
    { name: labels.clients, rows: [[labels.name, labels.contact, labels.status], ...clients.map((client) => [client.name, [client.phone, client.email].filter(Boolean).join(' · '), client.active ? labels.active : labels.inactive])] },
  ];
}

function worksheet(sheet: Sheet) {
  const rows = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, cellIndex) => {
    const reference = `${String.fromCharCode(65 + Math.min(cellIndex, 25))}${rowIndex + 1}`;
    return typeof cell === 'number' && Number.isFinite(cell)
      ? `<c r="${reference}"><v>${cell}</v></c>`
      : `<c r="${reference}" t="inlineStr"><is><t>${xml(String(cell ?? ''))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; content: string }[]) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const name = utf8(file.name);
    const data = utf8(file.content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(8, 0, true); view.setUint16(10, 0, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    header.set(name, 30);
    local.push(header, data);
    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); recordView.setUint16(4, 20, true); recordView.setUint16(6, 20, true); recordView.setUint16(8, 0, true); recordView.setUint16(10, 0, true);
    recordView.setUint32(16, crc, true); recordView.setUint32(20, data.length, true); recordView.setUint32(24, data.length, true); recordView.setUint16(28, name.length, true); recordView.setUint16(30, 0, true); recordView.setUint16(32, 0, true); recordView.setUint16(34, 0, true); recordView.setUint16(36, 0, true); recordView.setUint32(38, 0, true); recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);
    offset += header.length + data.length;
  });
  const centralBytes = concatBytes(central);
  const localBytes = concatBytes(local);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, centralBytes.length, true); endView.setUint32(16, localBytes.length, true);
  return concatBytes([localBytes, centralBytes, end]);
}

export function createStoreReportXlsx(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) {
  const sheets = sheetsFor(filterStoreReportState(state, range), currency, language, labels, range);
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheet(sheet) })),
  ]);
}

function pdfText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[–—·•]/g, '-').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (character) => `\\${character}`);
}

function pdfLines(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) {
  const report = storeReportData(state);
  const lines = [`${labels.title}: ${state.store.name}`, `${labels.generated}: ${dateLabel(new Date().toISOString(), language)}`, ...(range ? [`${labels.period}: ${range.label}`] : []), `${labels.balance}: ${amount(state.store.businessAccount.balance, currency, language)}`, `${labels.transactions}: ${report.sales.length}`, `${labels.amount}: ${amount(report.total, currency, language)}`, '', labels.salesByDay];
  report.daily.forEach(([date, value]) => lines.push(`${date} | ${value.count} ${labels.transactions} | ${amount(value.total, currency, language)}`));
  lines.push('', labels.topProducts);
  report.topProducts.forEach(([, value]) => lines.push(`${value.name} | ${value.quantity} ${labels.quantity} | ${amount(value.total, currency, language)}`));
  lines.push('', labels.topClients);
  report.topClients.forEach(([id, value]) => lines.push(`${state.store.clients.find((client) => client.id === id)?.name ?? id} | ${value.count} ${labels.transactions} | ${amount(value.total, currency, language)}`));
  lines.push('', labels.moneyMovements);
  state.store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date)).forEach((movement) => lines.push(`${dateLabel(movement.date, language)} | ${movement.type} | ${movement.note || '-'} | ${amount(movement.amount, currency, language)}`));
  lines.push('', labels.inventory);
  state.store.products.forEach((product) => lines.push(`${product.key} | ${product.name} | ${labels.stock}: ${productStock(state, product.id)} | ${labels.available}: ${Math.max(0, productStock(state, product.id) - product.reservedQuantity)}`));
  return lines;
}

export function createStoreReportPdf(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) {
  const allLines = pdfLines(filterStoreReportState(state, range), currency, language, labels, range);
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += 45) pages.push(allLines.slice(index, index + 45));
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((page, pageIndex) => {
    const contentId = 5 + pageIndex * 2;
    const commands = ['BT', '/F1 14 Tf', '45 800 Td'];
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push('0 -16 Td');
      commands.push(`(${pdfText(line.slice(0, 100))}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  const chunks = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
  const offsets: number[] = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => { offsets[index + 1] = length; const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; chunks.push(chunk); length += chunk.length; });
  const xref = length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return utf8(chunks.join(''));
}
