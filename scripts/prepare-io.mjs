import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import readExcel from 'read-excel-file/node';
import { levels, normalizeWorkbook } from '../src/io/model.ts';

const directory = process.argv[2];
if (!directory) throw new Error('공식 KOSIS 원본 폴더를 지정해 주세요.');
await mkdir('public/data', { recursive: true });
for (const { id } of levels) {
  const workbook = await readExcel(join(directory, `${id}.xlsx`));
  const book = normalizeWorkbook(workbook, id);
  // 배포 파일에는 정해진 시트의 표 제목/코드/숫자만 포함해요. 원본 ZIP과 문서 속성은 포함하지 않아요.
  const bytes = gzipSync(JSON.stringify(book), { level: 9 });
  await writeFile(`public/data/${id}.json.gz`, bytes);
  console.log(`${id}: ${book.sectors.length} sectors, ${bytes.length} bytes`);
}
