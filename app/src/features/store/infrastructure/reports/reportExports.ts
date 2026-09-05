import { productStock, storeAmount, storeBalance, storeReportData, storeReportHasMissingRates } from '@/features/store/domain/services/storeDomain';
import type { ReportExportLabels, StoreReportRange, StoreReportSource } from '@/features/store/application/ports/ReportRepository';

export type { ReportExportLabels, StoreReportRange } from '@/features/store/application/ports/ReportRepository';

type Sheet = { name: string; rows: (string | number)[][]; summary?: boolean };

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
  if (!range || (!range.start && !range.end)) return state;
  if (!range.start || !range.end) throw new Error('invalid-report-range');
  const start = localDayTimestamp(range.start);
  const end = localDayTimestamp(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('invalid-report-range');
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
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function reportSource(state: StoreReportSource, range?: StoreReportRange) {
  if (storeReportHasMissingRates(state)) throw new Error('missing-report-rate');
  const filtered = filterStoreReportState(state, range);
  return { ...filtered, store: { ...filtered.store, businessAccount: { ...filtered.store.businessAccount, balance: storeBalance(state) } } };
}

function sheetNames(sheets: Sheet[]) {
  const used = new Set<string>();
  return sheets.map((sheet) => {
    const base = sheet.name.replace(/[\\/\[\]:*?\x00-\x1F]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Report';
    let name = base.slice(0, 31);
    let suffix = 1;
    while (used.has(name.toLowerCase())) {
      const ending = ` (${++suffix})`;
      name = base.slice(0, 31 - ending.length) + ending;
    }
    used.add(name.toLowerCase());
    return { ...sheet, name };
  });
}

function sheetsFor(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange): Sheet[] {
  const report = storeReportData(state);
  const movements = state.store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date));
  const products = state.store.products.slice().sort((left, right) => left.name.localeCompare(right.name));
  const employees = state.store.employees.slice().sort((left, right) => left.name.localeCompare(right.name));
  const clients = state.store.clients.slice().sort((left, right) => left.name.localeCompare(right.name));
  const providers = state.store.providers.slice().sort((left, right) => left.name.localeCompare(right.name));
  const sales = report.sales.slice().sort((left, right) => right.date.localeCompare(left.date));
  const inventory = products.map((product) => [product.key, product.name, product.type, productStock(state, product.id), Math.max(0, productStock(state, product.id) - product.reservedQuantity), storeAmount(state, product.salePrice, product.currency)] as (string | number)[]);
  return [
    { name: labels.summary, summary: true, rows: [[labels.title, state.store.name], [labels.generated, dateLabel(new Date().toISOString(), language)], ...(range ? [[labels.period, range.label] as (string | number)[]] : []), [], [labels.balance, state.store.businessAccount.balance, currency], [labels.transactions, report.sales.length], [labels.amount, report.total, currency], [labels.topProducts, report.topProducts.length], [labels.topClients, report.topClients.length]] },
    { name: labels.sales, rows: [[labels.date, labels.name, labels.quantity, labels.amount, labels.status], ...sales.map((sale) => [dateLabel(sale.date, language), state.store.clients.find((client) => client.id === sale.clientId)?.name ?? '', sale.items.map((item) => `${item.name} × ${item.quantity}`).join('; '), storeAmount(state, sale.total, sale.currency), sale.status === 'completed' ? labels.active : labels.inactive])] },
    { name: labels.topProducts, rows: [[labels.name, labels.quantity, labels.amount], ...report.topProducts.map(([, value]) => [value.name, value.quantity, value.total])] },
    { name: labels.topClients, rows: [[labels.name, labels.transactions, labels.amount], ...report.topClients.map(([id, value]) => [state.store.clients.find((client) => client.id === id)?.name ?? id, value.count, value.total])] },
    { name: labels.moneyMovements, rows: [[labels.date, labels.type, labels.name, labels.amount], ...movements.map((movement) => [dateLabel(movement.date, language), (labels.movementTypes?.[movement.type] ?? movement.type), movement.note, storeAmount(state, movement.amount, movement.currency)])] },
    { name: labels.inventory, rows: [[labels.type, labels.name, labels.stock, labels.available, labels.salePrice], ...inventory.map((row) => [row[2], row[1], row[3], row[4], row[5]])] },
    { name: labels.employees, rows: [[labels.name, labels.role, labels.contact, labels.amount, labels.currency ?? 'Currency', labels.status], ...employees.map((employee) => [employee.name, employee.role ?? '', employee.phone ?? '', employee.salary, employee.salaryCurrency ?? state.store.currency, employee.active ? labels.active : labels.inactive])] },
    { name: labels.clients, rows: [[labels.name, labels.contact, labels.status], ...clients.map((client) => [client.name, [client.phone, client.email].filter(Boolean).join(' · '), client.active ? labels.active : labels.inactive])] },
    { name: labels.providers, rows: [[labels.name, labels.contact, labels.status], ...providers.map((provider) => [provider.name, [provider.phone, provider.email].filter(Boolean).join(' · '), provider.active ? labels.active : labels.inactive])] },
  ];
}

function columnName(index: number) {
  let value = '';
  let current = index + 1;
  while (current > 0) { const remainder = (current - 1) % 26; value = String.fromCharCode(65 + remainder) + value; current = Math.floor((current - 1) / 26); }
  return value;
}

function worksheet(sheet: Sheet) {
  const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 1);
  const rowCount = sheet.rows.length;
  const widths = Array.from({ length: columnCount }, (_, index) => Math.min(42, sheet.rows.reduce((max, row) => Math.max(max, String(row[index] ?? '').length + 2), 12)));
  const columns = widths.map((width, index) => {
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const rows = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}" ht="${Math.min(409, row.reduce<number>((height, cell, column) => Math.max(height, Math.ceil(String(cell).length / (widths[column] - 2)) * 16 + 4), 22))}" customHeight="1">${row.map((cell, cellIndex) => {
    const reference = `${columnName(cellIndex)}${rowIndex + 1}`;
    const style = rowIndex === 0 ? 2 : 1;
    return typeof cell === 'number' && Number.isFinite(cell)
      ? `<c r="${reference}" s="${style}"><v>${cell}</v></c>`
      : `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(cell ?? ''))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData>${rowCount > 1 && !sheet.summary ? `<autoFilter ref="A1:${columnName(columnCount - 1)}${rowCount}"/>` : ''}</worksheet>`;
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
  const sheets = sheetNames(sheetsFor(reportSource(state, range), currency, language, labels, range));
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9C877"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheet(sheet) })),
  ]);
}

function pdfText(value: string) {
  const extra: Record<string, number> = { '€': 128, 'Œ': 140, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, 'œ': 156, 'Ÿ': 159 };
  return Array.from(value.normalize('NFC')).map((character) => {
    const code = extra[character] ?? character.charCodeAt(0);
    if (code >= 160 && code <= 255 || extra[character]) return `\\${code.toString(8).padStart(3, '0')}`;
    if (code < 32) return ' ';
    if (code > 126) return '?';
    return /[\\()]/.test(character) ? `\\${character}` : character;
  }).join('');
}

type PdfLine = { text: string; kind: 'title' | 'meta' | 'metric' | 'section' | 'body' };

function pdfLines(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange): PdfLine[] {
  const report = storeReportData(state);
  const lines: PdfLine[] = [{ text: `${labels.title}: ${state.store.name}`, kind: 'title' }, { text: `${labels.generated}: ${dateLabel(new Date().toISOString(), language)}`, kind: 'meta' }, ...(range ? [{ text: `${labels.period}: ${range.label}`, kind: 'meta' as const }] : []), { text: `${labels.balance}: ${amount(state.store.businessAccount.balance, currency, language)}`, kind: 'metric' }, { text: `${labels.transactions}: ${report.sales.length}`, kind: 'metric' }, { text: `${labels.amount}: ${amount(report.total, currency, language)}`, kind: 'metric' }, { text: labels.sales, kind: 'section' }];
  report.sales.forEach((sale) => lines.push({ text: `${dateLabel(sale.date, language)} | ${state.store.clients.find((client) => client.id === sale.clientId)?.name ?? '-'} | ${sale.items.map((item) => `${item.name} x${item.quantity}`).join(', ')} | ${amount(storeAmount(state, sale.total, sale.currency), currency, language)}`, kind: 'body' }));
  lines.push({ text: labels.topProducts, kind: 'section' });
  report.topProducts.forEach(([, value]) => lines.push({ text: `${value.name} | ${value.quantity} ${labels.quantity} | ${amount(value.total, currency, language)}`, kind: 'body' }));
  lines.push({ text: labels.topClients, kind: 'section' });
  report.topClients.forEach(([id, value]) => lines.push({ text: `${state.store.clients.find((client) => client.id === id)?.name ?? id} | ${value.count} ${labels.transactions} | ${amount(value.total, currency, language)}`, kind: 'body' }));
  lines.push({ text: labels.moneyMovements, kind: 'section' });
  state.store.cashMovements.slice().sort((left, right) => right.date.localeCompare(left.date)).forEach((movement) => lines.push({ text: `${dateLabel(movement.date, language)} | ${labels.movementTypes?.[movement.type] ?? movement.type} | ${movement.note || '-'} | ${amount(storeAmount(state, movement.amount, movement.currency), currency, language)}`, kind: 'body' }));
  lines.push({ text: labels.inventory, kind: 'section' });
  state.store.products.forEach((product) => lines.push({ text: `${product.key} | ${product.name} | ${labels.stock}: ${productStock(state, product.id)} | ${labels.available}: ${Math.max(0, productStock(state, product.id) - product.reservedQuantity)}`, kind: 'body' }));
  return lines;
}

export function createStoreReportPdf(state: StoreReportSource, currency: string, language: string, labels: ReportExportLabels, range?: StoreReportRange) {
  const fontSizeFor = (kind: PdfLine['kind']) => kind === 'title' ? 14 : kind === 'metric' || kind === 'section' ? 11 : 9;
  const heightFor = (kind: PdfLine['kind']) => kind === 'title' ? 21 : kind === 'section' ? 23 : kind === 'metric' ? 18 : 15;
  // Standard Helvetica advances, in thousandths of an em, for printable ASCII.
  const widths = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const wrap = (text: string, max: number, fontSize: number) => {
    const measure = (value: string) => Array.from(value).reduce((sum, character) => sum + (widths[character.normalize('NFD').charCodeAt(0) - 32] ?? 1000) * fontSize / 1000, 0);
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      if (line && measure(`${line} ${word}`) > max) { lines.push(line); line = ''; }
      while (measure(word) > max) {
        let split = 1;
        while (split < word.length && measure(word.slice(0, split + 1)) <= max) split += 1;
        lines.push(word.slice(0, split)); word = word.slice(split);
      }
      line = line ? `${line} ${word}` : word;
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const allLines = pdfLines(reportSource(state, range), currency, language, labels, range).flatMap((line) => wrap(line.text, 500, fontSizeFor(line.kind)).map((text) => ({ ...line, text })));
  const heading = wrap(labels.title, 480, 12);
  const bannerHeight = Math.max(34, heading.length * 15 + 16);
  const bodyTop = 807 - bannerHeight - 18;
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let remaining = bodyTop - 55;
  allLines.forEach((line, index) => {
    const height = heightFor(line.kind);
    const required = height + (line.kind === 'section' && allLines[index + 1] ? heightFor(allLines[index + 1].kind) : 0);
    if (page.length && remaining < required) { pages.push(page); page = []; remaining = bodyTop - 55; }
    page.push(line);
    remaining -= height;
  });
  if (page.length) pages.push(page);
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((page, pageIndex) => {
    const contentId = 5 + pageIndex * 2;
    const commands = ['q', '0.92 0.76 0.38 rg', `45 ${824 - bannerHeight} 505 ${bannerHeight} re`, 'f', 'Q'];
    heading.forEach((text, index) => commands.push('BT', '/F1 12 Tf', `55 ${807 - index * 15} Td`, `(${pdfText(text)}) Tj`, 'ET'));
    let y = bodyTop;
    page.forEach((line) => {
      if (line.kind === 'section') {
        commands.push('q', '0.82 0.67 0.34 rg', `45 ${y - 4} 505 1 re`, 'f', 'Q', 'BT', '/F1 11 Tf', `45 ${y} Td`, `(${pdfText(line.text)}) Tj`, 'ET');
        y -= heightFor(line.kind);
        return;
      }
      const fontSize = fontSizeFor(line.kind);
      commands.push('BT', `/F1 ${fontSize} Tf`, `45 ${y} Td`, `(${pdfText(line.text)}) Tj`, 'ET');
      y -= heightFor(line.kind);
    });
    commands.push('BT', '/F1 8 Tf', '45 28 Td', `(${pdfText(`${pageIndex + 1}`)}) Tj`, 'ET');
    const stream = commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${utf8(stream).length} >>\nstream\n${stream}\nendstream`);
  });
  // All output is ASCII (non-ASCII text is escaped), so offsets equal byte lengths.
  const chunks = ['%PDF-1.4\n%Solid Gold Rich\n'];
  const offsets: number[] = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => { offsets[index + 1] = length; const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; chunks.push(chunk); length += chunk.length; });
  const xref = length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return utf8(chunks.join(''));
}
