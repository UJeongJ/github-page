import { useRef, useState } from 'react';
import { ArrowDown, ChartNoAxesCombined, Check, Database, ExternalLink, FileSpreadsheet, LoaderCircle, Table2 } from 'lucide-react';
import { Explorer } from '../io/Explorer';
import { Analysis } from '../io/Analysis';
import { levels, sourceUrl, type Book, type Level } from '../io/model';
import '../io/workspace.css';

const tiles = Array.from({length: 70}, (_, i) => (i * 37 + Math.floor(i / 7) * 11) % 9);

export default function Home() {
  const [level, setLevel] = useState<Level>('large');
  const [book, setBook] = useState<Book | null>(null);
  const [tab, setTab] = useState<'explore' | 'analyze'>('explore');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const current = levels.find(x => x.id === level)!;

  async function load() {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/${level}.json.gz`);
      if (!response.ok || !response.body) throw new Error('Official dataset unavailable');
      // Some static hosts set Content-Encoding: gzip; browsers already decode those responses.
      const payload = await response.arrayBuffer();
      const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
      const data = signature[0] === 0x1f && signature[1] === 0x8b
        ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as Book
        : JSON.parse(new TextDecoder().decode(payload)) as Book;
      if (data.level !== level || data.sheets.length !== 12) throw new Error('Unexpected dataset structure');
      setBook(data); setRevision(n => n + 1);
    } catch { setError('공식 자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { lock.current = false; setPending(false); }
  }

  return <div className="io-app min-h-screen bg-[#f1f5f3] text-[#152d29] [word-break:keep-all]">
    <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:z-10 focus:bg-white focus:p-3">본문으로 건너뛰기</a>
    <header className="border-b border-[#d9e4df] bg-white"><div className="mx-auto flex h-17 max-w-6xl items-center justify-between px-5 sm:px-8">
      <div className="flex items-center gap-3 font-bold"><span className="grid size-9 place-items-center rounded-lg bg-[#153e35] text-white"><ChartNoAxesCombined size={19} aria-hidden="true"/></span>산업연관 연구실</div>
      <a href={sourceUrl} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#35645a]" target="_blank" rel="noreferrer">공식 자료 <ExternalLink size={15} aria-hidden="true"/></a>
    </div></header>
    <main id="content" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#123b32] px-6 py-10 text-white sm:px-11 sm:py-13">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 -z-10 grid rotate-[-10deg] grid-cols-7 gap-1.5 opacity-25 sm:right-0 sm:opacity-65">{tiles.map((tone,i) => <span key={i} className="size-10 rounded-[3px] sm:size-12" style={{backgroundColor: `rgba(141, 224, 180, ${.08 + tone * .072})`}}/>)}</div>
        <p className="mb-4 inline-block rounded-full border border-[#6a9e87] px-3 py-1 text-xs font-semibold text-[#cef0df]">2023년 연장표 · 생산자가격</p>
        <h1 className="mb-4 text-4xl leading-tight font-extrabold tracking-[-0.02em] sm:text-6xl">산업연관 연구실</h1>
        <p className="max-w-md text-sm leading-7 text-[#daebe4] sm:text-base">투입산출표에서 산업 간 거래를 살펴보고, 최종수요의 변화가 생산과 부가가치에 미치는 파급효과를 계산해 보세요.</p>
        <a href="#workspace" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#cbf0d8] px-4 text-sm font-bold text-[#153b31]">자료 탐색 시작 <ArrowDown size={16} aria-hidden="true"/></a>
      </section>
      <section id="workspace" className="io-panel io-pad mt-7" aria-labelledby="work-title">
        <h2 id="work-title" className="io-heading flex items-center gap-2"><Database size={20} aria-hidden="true"/> 투입산출표 불러오기</h2>
        <p className="io-muted">분류를 선택한 뒤 불러오면 한국은행 자료의 12개 시트를 열 수 있어요.</p>
        <fieldset className="io-levels" disabled={pending}><legend className="sr-only">투입산출표 분류</legend>{levels.map(x => <label className="io-level" key={x.id}>
          <input className="sr-only" type="radio" name="io-level" checked={level === x.id} onChange={() => { setLevel(x.id); setError(''); }}/>
          <span className="io-level-label"><span>{x.name}</span><small>{x.count}개 부문</small></span><span className="io-muted">{x.note}</span>
        </label>)}</fieldset>
        <div className="io-actions">
          <button type="button" className="io-primary" disabled={pending} onClick={() => void load()}>{pending ? <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true"/> : <FileSpreadsheet size={17} aria-hidden="true"/>}{pending ? '자료 불러오는 중…' : '공식 자료 불러오기'}</button>
          <span role="status" className="io-status">{pending ? '표를 읽고 있어요.' : book ? <><Check size={16} aria-hidden="true"/>{levels.find(x => x.id === book.level)?.name} · 한국은행 자료를 불러왔어요</> : '선택: ' + current.name}</span>
        </div>
        {error && <p role="alert" className="io-error">{error}</p>}
      </section>
      {book ? <div className="io-panel mt-5" key={revision}>
        <nav className="io-tabs" aria-label="자료 활용"><button type="button" aria-pressed={tab === 'explore'} onClick={() => setTab('explore')}><Table2 size={17} aria-hidden="true"/> 시트 탐색</button><button type="button" aria-pressed={tab === 'analyze'} onClick={() => setTab('analyze')}><ChartNoAxesCombined size={17} aria-hidden="true"/> 산업연관 분석</button></nav>
        {tab === 'explore' ? <Explorer book={book}/> : <Analysis book={book}/>}
      </div> : <div className="io-guide mt-5">
        <section><Table2 size={20} aria-hidden="true"/><div><h2>시트와 산업 탐색</h2><p>산업 코드나 이름으로 거래액, 투입계수, 유발효과를 찾아보세요.</p></div></section>
        <section><ChartNoAxesCombined size={20} aria-hidden="true"/><div><h2>수요 변화 비교</h2><p>최종수요가 바뀌면 생산·부가가치·수입이 얼마나 달라지는지 살펴보세요.</p></div></section>
      </div>}
      <footer className="io-footer">
        <span>출처: <a href={sourceUrl} target="_blank" rel="noreferrer">한국은행 「산업연관표」, KOSIS 2023년 연장표</a></span>
        <span>공표 자료를 가공했어요.</span>
      </footer>
    </main>
  </div>;
}
