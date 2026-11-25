import type { Book } from './model';

export function readLocalWorkbook(file: File): Promise<Book> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./xlsx.worker.ts', import.meta.url), { type: 'module' });
    const done = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { done(); reject(new Error('엑셀을 읽는 데 시간이 너무 오래 걸려요. 공식 자료를 불러오거나 더 작은 분류의 파일을 선택해 주세요.')); }, 45000);
    worker.onmessage = ({ data }: MessageEvent<{ data: Book } | { error: string }>) => {
      done();
      if ('error' in data) reject(new Error(data.error));
      else resolve(data.data);
    };
    worker.onerror = () => { done(); reject(new Error('엑셀을 읽지 못했어요. 공식 자료를 불러오거나 다른 브라우저에서 다시 시도해 주세요.')); };
    worker.postMessage(file);
  });
}
