import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { unitAt, type Book, type Sheet } from './model';

const ko = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });
const coefficient = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 7 });
export const fmt = (n: number | null, unit: string) => n === null ? '—' : (unit === '무차원' ? coefficient : ko).format(n);
const normalized = (s: string) => s.toLowerCase().replace(/\s+/g, '');
export const includes = (value: string, query: string) => normalized(value).includes(normalized(query));

function SheetTable({ sheet }: { sheet: Sheet }) {
  const [rowQuery, setRowQuery] = useState('');
  const [colQuery, setColQuery] = useState('');
  const [rPage, setRPage] = useState(0);
  const [cPage, setCPage] = useState(0);
  const matches = (query: string) => ({ code, name }: { code: string; name: string }) => includes(`${code} ${name}`, query);
  const rows = sheet.rows.map((row, i) => ({ ...row, i })).filter(matches(rowQuery));
  const cols = sheet.cols.map((col, i) => ({ ...col, i })).filter(matches(colQuery));
  const visible = cols.slice(cPage * 5, cPage * 5 + 5);
  return <>
    <div className="io-fields">
      <label>행 검색 <span className="io-input-with-icon"><Search aria-hidden="true" size={16}/><input value={rowQuery} onChange={e => { setRowQuery(e.target.value); setRPage(0); }} placeholder="산업명, 코드, 합계 항목" type="search"/></span></label>
      <label>열 검색 <span className="io-input-with-icon"><Search aria-hidden="true" size={16}/><input value={colQuery} onChange={e => { setColQuery(e.target.value); setCPage(0); }} placeholder="산업명, 코드, 수요 항목" type="search"/></span></label>
    </div>
    <div className="io-tablebar"><p>{sheet.unit === '백만원' ? '금액 단위: 백만원 (2023년 생산자가격)' : '단위: 무차원 계수 / 지수'}</p><Pager label="열" page={cPage} count={cols.length} limit={5} change={setCPage}/></div>
    {rows.length && visible.length ? <div className="io-tablewrap" tabIndex={0} role="region" aria-label={`${sheet.name} 데이터 표`}>
      <table className="io-table"><caption className="sr-only">{sheet.name}</caption><thead><tr><th scope="col">코드 · 항목</th><th scope="col">단위</th>{visible.map(col => <th scope="col" key={col.code}><span>{col.code}</span>{col.name}</th>)}</tr></thead>
      <tbody>{rows.slice(rPage * 15, rPage * 15 + 15).map(row => <tr key={row.code}><th scope="row"><span>{row.code}</span>{row.name}</th><td>{unitAt(sheet, row)}</td>{visible.map(col => <td key={col.code}>{fmt(sheet.cells[row.i][col.i], unitAt(sheet, row))}</td>)}</tr>)}</tbody></table>
    </div> : <p className="io-empty">검색 결과가 없어요. 다른 코드나 이름을 입력해 주세요.</p>}
    <div className="io-tablebar"><p>{rows.length.toLocaleString('ko-KR')}개 행 · {cols.length.toLocaleString('ko-KR')}개 열 <span className="hidden sm:inline">/ —는 원본의 빈 셀이에요.</span></p><Pager label="행" page={rPage} count={rows.length} limit={15} change={setRPage}/></div>
  </>;
}

function Pager({ label, page, count, limit, change }: { label: string; page: number; count: number; limit: number; change: (page: number) => void }) {
  return <div className="io-pager"><button type="button" aria-label={`이전 ${label}`} disabled={!page} onClick={() => change(page - 1)}><ChevronLeft size={16} aria-hidden="true"/></button><span>{label} {count ? page * limit + 1 : 0}–{Math.min((page + 1) * limit, count)}</span><button type="button" aria-label={`다음 ${label}`} disabled={(page + 1) * limit >= count} onClick={() => change(page + 1)}><ChevronRight size={16} aria-hidden="true"/></button></div>;
}

export function Explorer({ book }: { book: Book }) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [query, setQuery] = useState('');
  const filtered = book.sheets.map((sheet, i) => ({ sheet, i })).filter(({ sheet }) => includes(sheet.name, query));
  const selected = filtered.find(s => s.i === sheetIndex) ?? filtered[0];
  return <section className="io-pad" aria-labelledby="sheets-title">
    <h2 id="sheets-title" className="io-heading">시트 탐색</h2>
    <p className="io-muted">시트를 고르고, 행과 열을 각각 검색해 필요한 값을 찾아보세요.</p>
    <div className="io-fields">
      <label>시트 검색 <span className="io-input-with-icon"><Search aria-hidden="true" size={16}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="예: 생산유발, 국산거래"/></span></label>
      <label>시트 선택 <select value={selected?.i ?? ''} onChange={e => setSheetIndex(Number(e.target.value))} disabled={!filtered.length}>{!filtered.length ? <option value="">검색 결과 없음</option> : filtered.map(({ sheet, i }) => <option value={i} key={sheet.name}>{sheet.name}</option>)}</select></label>
    </div>
    {selected ? <SheetTable key={selected.i} sheet={selected.sheet}/> : <p className="io-empty">다른 이름으로 시트를 검색해 주세요.</p>}
  </section>;
}
