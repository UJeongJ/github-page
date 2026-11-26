
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDownWideNarrow, BarChart3, Download, FileSpreadsheet, Plus, X } from 'lucide-react';
import { fmt, includes } from './Explorer';
import { find, scenario, sum, valueAt, levels, type Book } from './model';
import './upgrade.css';

type Result = ReturnType<typeof scenario>;
const metrics = [
  { key: 'production', name: '생산 유발액', color: '#244f78' },
  { key: 'valueAdded', name: '부가가치 유발액', color: '#23836b' },
  { key: 'imports', name: '수입 유발액', color: '#b87932' },
] as const;
type MetricKey = typeof metrics[number]['key'];
const money = (value: number | null) => fmt(value, '백만원');
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function downloadRows(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadScenario(book: Book, result: Result, totals: { key: MetricKey; name: string; value: number }[]) {
  const header = ['산업코드', '산업명', ...metrics.map(m => `${m.name}(백만원)`)];
  const rows = result.map(row => [row.code, row.name, row.production, row.valueAdded, row.imports]);
  rows.push(['합계', '전체 부문 합계', totals[0].value, totals[1].value, totals[2].value] as (string | number)[]);
  downloadRows(`산업연관분석_${book.level}_시나리오.csv`, header, rows);
}

type CompareRow = {
  code: string;
  name: string;
  production: number;
  valueAdded: number;
};

function IndustryCompare({ book }: { book: Book }) {
  const [amount, setAmount] = useState('1000');
  const [order, setOrder] = useState<'production' | 'valueAdded'>('production');
  const [all, setAll] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<CompareRow[] | null>(null);

  const levelName = levels.find(level => level.id === book.level)?.name ?? book.level;
  const ranked = useMemo(
    () => rows ? [...rows].sort((a, b) => b[order] - a[order]) : [],
    [rows, order]
  );
  const leaders = ranked.slice(0, 5);
  const maxBar = Math.max(1, ...leaders.map(row => Math.abs(row[order])));

  function calculate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const increase = Number(amount);
      if (!amount || !Number.isFinite(increase) || increase <= 0 || increase > 1e9) {
        throw new Error('최종수요 증가액은 0보다 크고 10억 백만원 이내로 입력해 주세요.');
      }

      const productionSheet = book.sheets[6];
      const valueAddedSheet = book.sheets[8];

      const result = book.sectors.map((sector, col): CompareRow => {
        const productionCol = find(productionSheet.cols, sector.code);
        const valueAddedCol = find(valueAddedSheet.cols, sector.code);

        if (productionCol < 0 || valueAddedCol < 0) {
          throw new Error(`${sector.name}의 유발계수 열을 찾을 수 없어요.`);
        }

        let production = 0;
        let valueAdded = 0;

        for (let row = 0; row < book.sectors.length; row++) {
          const p = productionSheet.cells[row]?.[productionCol];
          const v = valueAddedSheet.cells[row]?.[valueAddedCol];

          if (p === null || p === undefined || v === null || v === undefined) {
            throw new Error(`${sector.name}의 유발계수에 빈 셀이 있어 계산할 수 없어요.`);
          }

          production += p * increase;
          valueAdded += v * increase;
        }

        return {
          code: sector.code,
          name: sector.name,
          production,
          valueAdded,
        };
      });

      setRows(result);
      setError('');
      setAll(false);
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : '계산할 수 없어요.');
    }
  }

  function download() {
    if (!ranked.length) return;
    const header = ['순위', '산업코드', '산업명', '생산유발액(백만원)', '부가가치유발액(백만원)'];
    const data = ranked.map((row, index) => [
      index + 1, row.code, row.name, row.production, row.valueAdded
    ]);
    downloadRows(`전체산업비교_${book.level}.csv`, header, data);
  }

  return <>
    <p className="io-muted">
      현재 불러온 산업 분류의 모든 산업에 동일한 최종수요 증가액을 적용해
      생산유발효과와 부가가치유발효과를 비교합니다.
    </p>

    <div className="io-compare-info">
      <strong>{levelName}</strong>
      <span>분석 대상 {book.sectors.length}개 산업</span>
    </div>

    <form className="io-compare-form" onSubmit={calculate}>
      <label>
        모든 산업에 적용할 최종수요 증가액 (백만원)
        <input
          type="number"
          min="0.000001"
          max="1000000000"
          step="any"
          required
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </label>
      <button className="io-primary" type="submit">
        <BarChart3 size={17} aria-hidden="true" />
        전체 산업 비교 실행
      </button>
    </form>

    {error && <p role="alert" className="io-error">{error}</p>}

    {rows && <>
      <section className="io-upgrade-summary" aria-label="전체 산업 비교 결과">
        <div className="io-upgrade-summary-title">
          <BarChart3 size={18} aria-hidden="true" />
          전체 산업 비교 결과
        </div>
        <p>
          {levelName} {rows.length}개 산업에 각각 {money(Number(amount))}백만원의
          최종수요 증가를 가정했습니다.
          생산유발효과 1위는 { [...rows].sort((a, b) => b.production - a.production)[0].name },
          부가가치유발효과 1위는 { [...rows].sort((a, b) => b.valueAdded - a.valueAdded)[0].name }입니다.
        </p>
        <small>단위: 백만원 · 2023년 생산자가격 · 공표 유발계수 기반 계산</small>
      </section>

      <div className="io-compare-section">
        <h3 className="font-bold">산업별 상위 5개 비교</h3>
        <label className="io-order">
          <span className="sr-only">비교 지표</span>
          <select value={order} onChange={e => setOrder(e.target.value as 'production' | 'valueAdded')}>
            <option value="production">생산유발효과</option>
            <option value="valueAdded">부가가치유발효과</option>
          </select>
        </label>

        {leaders.map((row, index) => (
          <div className="io-bar-row" key={row.code}>
            <div className="io-bar-label">
              <span>{index + 1}. {row.name}</span>
              <strong>{money(row[order])}</strong>
            </div>
            <div className="io-bar-track">
              <span style={{
                width: `${Math.max(0, row[order] / maxBar * 100)}%`,
                background: order === 'production' ? '#244f78' : '#23836b'
              }} />
            </div>
          </div>
        ))}
      </div>

      <div className="io-tablebar">
        <p>전체 산업 비교 결과 · 높은 순서</p>
        <label className="io-order">
          <ArrowDownWideNarrow aria-hidden="true" size={17} />
          <span className="sr-only">정렬 지표</span>
          <select value={order} onChange={e => setOrder(e.target.value as 'production' | 'valueAdded')}>
            <option value="production">생산유발액 순</option>
            <option value="valueAdded">부가가치유발액 순</option>
          </select>
        </label>
      </div>

      <div className="io-tablewrap" role="region" aria-label="전체 산업 비교표" tabIndex={0}>
        <table className="io-table">
          <caption className="sr-only">전체 산업 생산 및 부가가치 유발액 · 백만원</caption>
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">산업</th>
              <th scope="col">생산유발액</th>
              <th scope="col">부가가치유발액</th>
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, all ? undefined : 12).map((row, index) => (
              <tr key={row.code}>
                <td>{index + 1}</td>
                <th scope="row"><span>{row.code}</span>{row.name}</th>
                <td>{money(row.production)}</td>
                <td>{money(row.valueAdded)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="io-upgrade-actions">
        <button className="io-secondary" type="button" onClick={() => setAll(x => !x)}>
          {all ? '상위 12개만 보기' : `전체 ${ranked.length}개 산업 보기`}
        </button>
        <button className="io-primary" type="button" onClick={download}>
          <FileSpreadsheet size={17} aria-hidden="true" />
          <Download size={15} aria-hidden="true" />
          엑셀용 결과 다운로드
        </button>
      </div>
      <p className="io-muted mt-2">
        다운로드 파일은 엑셀에서 바로 열 수 있는 CSV(UTF-8) 형식입니다.
      </p>
    </>}
  </>;
}

function Scenario({ book }: { book: Book }) {
  const [shocks, setShocks] = useState([{ id: 0, code: book.sectors[0].code, amount: '1000' }]);
  const [next, setNext] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [order, setOrder] = useState<MetricKey>('production');
  const [all, setAll] = useState(false);
  const [error, setError] = useState('');
  const totals = result ? metrics.map(metric => ({ ...metric, value: sum(result.map(row => row[metric.key])) })) : null;
  const ranked = useMemo(() => result ? [...result].sort((a, b) => Math.abs(b[order]) - Math.abs(a[order])) : [], [result, order]);
  const leaders = ranked.slice(0, 5);
  const maxBar = Math.max(1, ...leaders.map(row => Math.abs(row[order])));

  function calculate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const values: Record<string, number> = {};
      for (const { code, amount } of shocks) {
        const n = Number(amount);
        if (!amount || !Number.isFinite(n) || Math.abs(n) > 1e9) throw new Error('변화액은 ±10억 백만원 이내 숫자로 입력해 주세요.');
        values[code] = (values[code] ?? 0) + n;
      }
      if (Object.values(values).every(n => n === 0)) throw new Error('0이 아닌 최종수요 변화액을 입력해 주세요.');
      setResult(scenario(book, values)); setError(''); setAll(false);
    } catch (err) { setResult(null); setError(err instanceof Error ? err.message : '계산할 수 없어요.'); }
  }

  const summary = result && totals && leaders.length
    ? `입력한 최종수요 변화에 따라 전체 산업에서 생산 ${money(totals[0].value)}백만원, 부가가치 ${money(totals[1].value)}백만원, 수입 ${money(totals[2].value)}백만원의 변화가 계산됐습니다. ${order === 'production' ? '생산' : order === 'valueAdded' ? '부가가치' : '수입'} 유발액 기준으로 가장 큰 산업은 ${leaders[0].name}(${leaders[0].code})입니다.`
    : '';

  return <>
    <p className="io-muted">국산 상품별 최종수요의 증감액을 입력하면, 다른 부문까지 이어지는 효과를 계산해요. 수요 감소는 음수로 입력하세요.</p>
    <form className="mt-5" onSubmit={calculate}>
      {shocks.map(({ id, code, amount }, i) => <div className="io-shock" key={id}>
        <label>수요 변화 산업 {i + 1}<select value={code} onChange={e => { setResult(null); setShocks(old => old.map(item => item.id === id ? { ...item, code: e.target.value } : item)); }}>{book.sectors.map(s => <option value={s.code} key={s.code}>{s.code} · {s.name}</option>)}</select></label>
        <label>변화액 {i + 1} (백만원)<input type="number" required min={-1e9} max={1e9} step="any" value={amount} onChange={e => { setResult(null); setShocks(old => old.map(item => item.id === id ? { ...item, amount: e.target.value } : item)); }}/></label>
        {shocks.length > 1 && <button className="io-secondary" type="button" aria-label={`${i + 1}번째 산업 제거`} onClick={() => { setResult(null); setShocks(old => old.filter(item => item.id !== id)); }}><X size={16} aria-hidden="true"/></button>}
      </div>)}
      <div className="mt-4 flex flex-wrap gap-2"><button className="io-secondary" type="button" disabled={shocks.length >= 8} onClick={() => { setResult(null); setShocks(old => [...old, { id: next, code: book.sectors[0].code, amount: '' }]); setNext(next + 1); }}><Plus size={17} aria-hidden="true"/> 산업 추가</button><button className="io-primary" type="submit">파급효과 계산</button></div>
      {error && <p role="alert" className="io-error">{error}</p>}
    </form>
    {result && totals && <div className="mt-6">
      <h3 className="font-bold" role="status">전 부문 파급효과 합계 <span className="io-muted">(백만원)</span></h3>
      <div className="io-stats">{totals.map(m => <div key={m.key}><small>{m.name}</small><strong>{money(m.value)}</strong></div>)}</div>
      <section className="io-upgrade-summary" aria-label="분석 결과 자동 요약">
        <div className="io-upgrade-summary-title"><BarChart3 size={18} aria-hidden="true"/> 분석 결과 요약</div>
        <p>{summary}</p>
        <small>단위: 백만원 · 2023년 생산자가격 · 공표 유발계수 기반 계산</small>
      </section>
      <div className="io-upgrade-chart">
        <div className="io-tablebar"><p className="font-bold">산업별 유발효과 상위 5개</p><label className="io-order"><span className="sr-only">그래프 지표</span><select value={order} onChange={e => setOrder(e.target.value as MetricKey)}>{metrics.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}</select></label></div>
        {leaders.map((row, index) => <div className="io-bar-row" key={row.code}>
          <div className="io-bar-label"><span>{index + 1}. {row.name}</span><strong>{money(row[order])}</strong></div>
          <div className="io-bar-track"><span style={{ width: `${Math.max(0, Math.abs(row[order]) / maxBar * 100)}%`, background: metrics.find(m => m.key === order)?.color }} /></div>
        </div>)}
        <p className="io-muted">막대 길이는 선택한 지표의 절댓값을 기준으로 표시합니다.</p>
      </div>
      <div className="io-tablebar"><p>부문별 결과 · 변화 절댓값이 큰 순서</p><label className="io-order"><ArrowDownWideNarrow aria-hidden="true" size={17}/><span className="sr-only">정렬 지표</span><select value={order} onChange={e => setOrder(e.target.value as MetricKey)}>{metrics.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}</select></label></div>
      <div className="io-tablewrap" role="region" aria-label="부문별 파급효과 결과" tabIndex={0}>
        <table className="io-table"><caption className="sr-only">부문별 파급효과 · 백만원</caption>
          <thead><tr><th scope="col">산업</th>{metrics.map(m => <th scope="col" key={m.key}>{m.name}</th>)}</tr></thead>
          <tbody>{ranked.slice(0, all ? undefined : 12).map(r => <tr key={r.code}><th scope="row"><span>{r.code}</span>{r.name}</th>{metrics.map(m => <td key={m.key}>{money(r[m.key])}</td>)}</tr>)}</tbody>
          <tfoot><tr><th scope="row">전체 부문 합계 <span>(백만원)</span></th>{totals.map(m => <td key={m.key}>{money(m.value)}</td>)}</tr></tfoot>
        </table>
      </div>
      <div className="io-upgrade-actions">
        <button className="io-secondary" type="button" onClick={() => setAll(x => !x)}>{all ? '상위 12개만 보기' : `전체 ${result.length}개 산업 보기`}</button>
        <button className="io-primary" type="button" onClick={() => downloadScenario(book, result, totals)}><FileSpreadsheet size={17} aria-hidden="true"/><Download size={15} aria-hidden="true"/> 엑셀용 결과 다운로드</button>
      </div>
      <p className="io-muted mt-2">다운로드 파일은 엑셀에서 바로 열 수 있는 CSV(UTF-8) 형식입니다.</p>
    </div>}
  </>;
}

function Industry({ book }: { book: Book }) {
  const [query, setQuery] = useState('');
  const [code, setCode] = useState(book.sectors[0].code);
  const [demand, setDemand] = useState('9190');
  const options = book.sectors.filter(s => includes(`${s.code} ${s.name}`, query));
  const item = options.find(s => s.code === code) ?? options[0];
  const [total, , , direct, imported, domestic, induced, , , ...historical] = book.sheets;
  const impacts = [{ name: '총산출', unit: '백만원', value: item && valueAt(total, item.code, '9310') }, { name: '중간투입률', unit: '%', value: item && ratio(valueAt(direct, '9590', item.code)) }, { name: '수입 중간투입률', unit: '%', value: item && ratio(valueAt(imported, '9590', item.code)) }, { name: '부가가치율', unit: '%', value: item && ratio(valueAt(direct, '9690', item.code)) }, { name: '영향력계수', unit: '무차원', value: item && valueAt(induced, '9801', item.code) }, { name: '감응도계수', unit: '무차원', value: item && valueAt(induced, item.code, '9802') }];
  const c = item ? find(domestic.cols, item.code) : -1;
  const inputs = c < 0 ? [] : book.sectors.map((s, r) => ({ ...s, coefficient: domestic.cells[r][c] })).filter(s => s.coefficient !== null && s.coefficient > 0).sort((a,b) => b.coefficient! - a.coefficient!).slice(0, 8);
  return <>
    <p className="io-muted">어떤 산업이 국산 중간재를 공급하는지, 2023년의 소비·투자·수출이 얼마나 생산 등을 유발했는지 살펴보세요.</p>
    <div className="io-fields"><label>산업 검색<input type="search" value={query} placeholder="산업 코드 또는 이름" onChange={e => setQuery(e.target.value)}/></label><label>산업 선택<select value={item?.code ?? ''} disabled={!item} onChange={e => setCode(e.target.value)}>{item ? options.map(s => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>) : <option value="">검색 결과 없음</option>}</select></label></div>
    {item ? <>
      <div className="io-stats">{impacts.map(m => <div key={m.name}><small>{m.name} ({m.unit})</small><strong>{fmt(m.value ?? null, m.unit)}</strong></div>)}</div>
      <div className="io-fields io-detail">
        <section><h3 className="font-bold">주요 국산 중간재 공급 산업</h3><p className="io-muted">산출 1단위당 국산 중간투입계수 · 무차원</p>
          {inputs.length ? <ol className="io-list">{inputs.map(s => <li key={s.code}><span>{s.code} · {s.name}</span><strong>{fmt(s.coefficient, '무차원')}</strong></li>)}</ol> : <p className="io-muted">양수인 국산 중간투입 항목이 없어요.</p>}
        </section>
        <section><h3 className="font-bold">최종수요 항목별 유발액</h3><p className="io-muted">선택 산업에 유발된 실적 · 백만원</p>
          <label className="mt-3">2023년 최종수요 항목<select value={demand} onChange={e => setDemand(e.target.value)}>{historical[0].cols.map(d => <option value={d.code} key={d.code}>{d.name}</option>)}</select></label>
          <ul className="io-list">{historical.map(s => <li key={s.name}><span>{s.name.replace('최종수요 항목별 ', '')}</span><strong>{money(valueAt(s, item.code, demand))}</strong></li>)}</ul>
        </section>
      </div>
    </> : <p className="io-empty">검색한 산업이 없어요. 다른 코드를 입력해 주세요.</p>}
  </>;
}

const ratio = (n: number | null) => n === null ? null : n * 100;

export function Analysis({ book }: { book: Book }) {
  const [mode, setMode] = useState<'scenario' | 'industry' | 'compare'>('scenario');

  return <section className="io-pad" aria-labelledby="analysis-title">
    <h2 id="analysis-title" className="io-heading">산업연관 분석</h2>
    <div className="io-switch">
      <button type="button" aria-pressed={mode === 'scenario'} onClick={() => setMode('scenario')}>수요 변화 시나리오</button>
      <button type="button" aria-pressed={mode === 'industry'} onClick={() => setMode('industry')}>산업 구조와 수요 실적</button>
      <button type="button" aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>전체 산업 비교</button>
    </div>
    {mode === 'scenario' ? <Scenario book={book}/> : mode === 'industry' ? <Industry book={book}/> : <IndustryCompare book={book}/>}
    <p className="io-footnote">한국은행 공표 계수와 실적을 가공한 결과예요. 시나리오는 2023년의 투입 구조와 가격이 유지된다는 가정에 따른 추정이며 예측이나 인과 효과가 아니에요.</p>
  </section>;
}
