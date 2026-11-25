export const levels = [
  { id: 'large', name: '통합대분류', count: 33, note: '경제 전체 조망' },
  { id: 'medium', name: '통합중분류', count: 83, note: '산업군 비교' },
  { id: 'small', name: '통합소분류', count: 165, note: '세부 산업 비교' },
  { id: 'basic', name: '기본부문', count: 380, note: '가장 세밀한 상품 단위' },
] as const;

export const sheetNames = ['A표_총거래표(생산자)', 'A표_수입거래표(생산자)', 'A표_국산거래표(생산자)', '총투입계수(A)', '수입투입계수(Am)', '국산투입계수(Ad)', '생산유발계수', '수입유발계수', '부가가치유발계수', '최종수요 항목별 생산유발액', '최종수요 항목별 수입유발액', '최종수요 항목별 부가가치유발액'] as const;
export const sourceUrl = 'https://stat.kosis.kr/nsibsHtmlSvc/fileView/FileStbl/fileStblView.do?conn_path=E1&in_org_id=301&in_tbl_id=DT_301010_FILE2023&tab_yn=N';
export type Level = typeof levels[number]['id'];
export type SheetName = typeof sheetNames[number];
export type Label = { code: string; name: string };
export type Sheet = { name: SheetName; unit: '백만원' | '무차원'; rows: Label[]; cols: Label[]; cells: (number | null)[][] };
export type Book = { level: Level; sectors: Label[]; sheets: Sheet[] };
type Workbook = { sheet: string; data: unknown[][] }[];

function label(code: unknown, name: unknown): Label | null {
  if ((typeof code !== 'string' && typeof code !== 'number') || typeof name !== 'string') return null;
  const id = String(code).trim();
  const text = name.replace(/\s+/g, ' ').trim();
  if (!/^(?:[A-Z][0-9]{0,2}|[0-9]{2,4})$/.test(id) || !text || text.length > 120 || /[@]|\d(?:[ -]?\d){6,}/.test(text)) return null;
  return { code: id, name: text };
}

export function normalizeWorkbook(workbook: Workbook, expected?: Level): Book {
  const sheets = sheetNames.map((name, i): Sheet => {
    const raw = workbook.find(s => s.sheet === name)?.data;
    if (!raw || raw[1]?.[0] !== '2023년' || raw[2]?.[0] !== '생산자가격' || !raw[4] || !raw[5]) throw new Error(`2023년 생산자가격 표의 ‘${name}’ 시트를 찾을 수 없어요.`);
    const money = i < 3 || i >= 9;
    if (money && !/^단위\s*:\s*백만원$/.test(String(raw[3]?.[0]))) throw new Error(`‘${name}’ 시트에서 백만원 단위를 확인할 수 없어요.`);
    const cols = raw[4].slice(2).map((code, col) => label(code, raw[5][col + 2]));
    if (cols.some(col => !col)) throw new Error(`‘${name}’ 시트의 열 코드 또는 이름을 확인해 주세요.`);
    const rows: Label[] = [];
    const cells: Sheet['cells'] = [];
    for (const row of raw.slice(6)) {
      if (row.every(value => value == null)) continue;
      const item = label(row[0], row[1]);
      if (!item) throw new Error(`‘${name}’ 시트의 행 코드 또는 이름을 확인해 주세요.`);
      rows.push(item);
      cells.push(cols.map((_, col) => {
        const value = row[col + 2];
        if (value == null) return null;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        throw new Error(`‘${name}’ 시트에서 숫자가 아닌 셀을 발견했어요.`);
      }));
    }
    if (new Set(rows.map(r => r.code)).size !== rows.length || new Set(cols.map(c => c?.code)).size !== cols.length) throw new Error(`‘${name}’ 시트에 중복된 코드가 있어요.`);
    return { name, unit: money ? '백만원' : '무차원', rows, cols: cols as Label[], cells };
  });
  const total = sheets[0];
  const count = total.cols.findIndex(c => c.code === '9090');
  const level = levels.find(entry => entry.count === count);
  if (!level || (expected && expected !== level.id)) throw new Error('공식 분류별 부문 수와 파일의 부문 수가 일치하지 않아요. 원본을 확인해 주세요.');
  const sectors = total.cols.slice(0, count);
  const matches = (items: Label[]) => sectors.every((sector, i) => sector.code === items[i]?.code);
  if (sheets.some((sheet, i) => !matches(sheet.rows) || (i < 9 && !matches(sheet.cols)))) throw new Error('시트의 상품 코드와 순서가 일치하지 않아요.');
  return { level: level.id, sectors, sheets };
}

export const find = (items: Label[], code: string) => items.findIndex(item => item.code === code);
export const valueAt = (sheet: Sheet, row: string, col: string) => sheet.cells[find(sheet.rows, row)]?.[find(sheet.cols, col)] ?? null;
export const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

export function scenario(book: Book, shocks: Record<string, number>) {
  const vector = book.sectors.map(s => shocks[s.code] ?? 0);
  const effect = (sheet: Sheet, r: number) => vector.reduce((total, shock, c) => {
    if (!shock) return total;
    const value = sheet.cells[r][c];
    if (value === null) throw new Error('선택한 산업의 유발계수에 빈 셀이 있어 계산할 수 없어요.');
    return total + value * shock;
  }, 0);
  return book.sectors.map((s, r) => ({ ...s, production: effect(book.sheets[6], r), imports: effect(book.sheets[7], r), valueAdded: effect(book.sheets[8], r) }));
}

export function unitAt(sheet: Sheet, row: Label) {
  if (sheet.name.startsWith('최종수요')) {
    if (row.code === '9812') return '%';
    if (row.code === '9811') return '무차원';
  }
  return sheet.unit;
}
