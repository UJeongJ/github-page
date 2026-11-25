import readExcel from 'read-excel-file/browser';
import { normalizeWorkbook } from './model';

self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  try {
    let workbook;
    try { workbook = await readExcel(file); }
    catch { throw new Error('엑셀을 열 수 없어요. 12개 시트가 있는 2023년 생산자가격 .xlsx 원본을 선택해 주세요.'); }
    self.postMessage({ data: normalizeWorkbook(workbook) });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : '엑셀을 읽지 못했어요. 원본을 확인해 주세요.' });
  }
};
