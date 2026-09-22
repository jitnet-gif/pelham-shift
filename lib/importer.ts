import type {Attendance} from './domain';
export const fields=[['employeeId','직원 ID'],['date','근무일'],['start','출근'],['end','퇴근'],['breakMinutes','휴게(분)']] as const;
// Time clocks export .xlsx or .csv; both reach the import screen as the same rows of text.
export async function readAttendanceFile(file:File):Promise<string[][]>{if(file.size>5*1024*1024)throw new Error('5MB 이하 파일만 업로드할 수 있습니다.');const name=file.name.toLowerCase();if(!name.endsWith('.xlsx')&&!name.endsWith('.csv'))throw new Error('.xlsx 또는 .csv 형식으로 저장한 파일을 선택하세요.');const rows=name.endsWith('.csv')?parseCsv(decodeText(await file.arrayBuffer())):await readWorkbook(file);if(rows.length>3001)throw new Error('최대 3,000개 행을 가져올 수 있습니다.');if(rows.length<2)throw new Error('제목 행과 출근기록이 필요합니다.');return rows}
async function readWorkbook(file:File):Promise<string[][]>{const ExcelJS=await import('exceljs');const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const ws=wb.worksheets[0];if(!ws)throw new Error('첫 번째 시트가 비어 있습니다.');if(ws.rowCount>3001)throw new Error('최대 3,000개 행을 가져올 수 있습니다.');const rows:string[][]=[];ws.eachRow(row=>{const values:string[]=[];for(let i=1;i<=ws.columnCount;i++){const cell=row.getCell(i);const v=cell.value;if(v instanceof Date){values.push(v.getUTCFullYear()<1901?v.toISOString().slice(11,16):v.toISOString().slice(0,10))}else if(typeof v==='number'&&v>=0&&v<1){const m=Math.round(v*1440);values.push(String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'))}else values.push(cell.text.trim())}rows.push(values)});return rows}
// Korean Excel still saves CSV as CP949, so a UTF-8 decode that lands on a replacement character is retried as EUC-KR.
function decodeText(buffer:ArrayBuffer):string{const utf8=new TextDecoder().decode(buffer);if(!utf8.includes(String.fromCharCode(0xfffd)))return utf8;try{return new TextDecoder('euc-kr').decode(buffer)}catch{return utf8}}
// Quoted fields keep their own delimiters, newlines and doubled quotes; a trailing newline is not a row.
function parseCsv(text:string):string[][]{if(text.charCodeAt(0)===0xfeff)text=text.slice(1);const d=delimiterOf(text),rows:string[][]=[];let row:string[]=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c!=='"')field+=c;else if(text[i+1]==='"'){field+='"';i++}else quoted=false}else if(c==='"')quoted=true;else if(c===d){row.push(field.trim());field=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());rows.push(row);row=[];field=''}else field+=c}if(field!==''||row.length){row.push(field.trim());rows.push(row)}while(rows.length&&rows[rows.length-1].every(v=>v===''))rows.pop();return rows}
// Korean and European spreadsheets save CSV with a semicolon or a tab, so the header row picks the delimiter.
function delimiterOf(text:string):string{const counts:Record<string,number>={',':0,';':0,'\t':0};let quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"')i++;else quoted=!quoted}else if(quoted)continue;else if(c==='\n'||c==='\r')break;else if(c in counts)counts[c]++}return Object.keys(counts).reduce((a,b)=>counts[b]>counts[a]?b:a,',')}
// 출근기계의 Timecard Report. 직원마다 블록이 있고, 한 날에 여러 번 찍은 줄은 날짜 칸이 비어 있습니다.
export type Timecard={rows:{name:string;date:string;start:string;end:string}[];open:{name:string;date:string;start:string}[]};
const hhmm=(v:string)=>/^\d{1,2}:\d{2}$/.test(v)?v.padStart(5,'0'):'';
// 이름이 조금씩 달라도(오타, 성·이름 순서, 가운데 이름, 대소문자) 같은 사람을 찾아내려면 글자 두 개씩 묶어 겹치는 정도를 봅니다.
// Dice 계수 0~1. 1이면 완전히 같은 이름입니다. 자동으로 적용하지 않고 관리자에게 후보로 보여 주기만 합니다.
const bigrams=(v:string)=>{const out=new Map<string,number>();for(let i=0;i<v.length-1;i++){const g=v.slice(i,i+2);out.set(g,(out.get(g)??0)+1)}return out};
const plain=(v:string)=>v.toLowerCase().replace(/[^a-z0-9가-힣]+/g,'');
export function similarity(a:string,b:string):number{
 const x=plain(a),y=plain(b);
 if(!x||!y)return 0;
 if(x===y)return 1;
 if(x.length<2||y.length<2)return 0;
 const gx=bigrams(x),gy=bigrams(y);let hit=0,total=0;
 for(const [g,n] of gx){total+=n;hit+=Math.min(n,gy.get(g)??0)}
 for(const [,n] of gy)total+=n;
 return (2*hit)/total;
}
// 후보를 비슷한 정도 순으로 돌려줍니다. 같은 점수면 이름순입니다.
export function nameCandidates<T extends {name:string}>(name:string,people:T[]){return people.map(person=>({person,score:similarity(name,person.name)})).sort((a,b)=>b.score-a.score||a.person.name.localeCompare(b.person.name))}
// 이 점수 아래는 근거가 약해 미리 골라 두지 않고 관리자가 직접 고르게 합니다.
export const NAME_MATCH_MIN=0.45;
export function parseTimecard(rows:string[][]):Timecard|null{
 if(!rows.some(r=>r.some(c=>c.trim()==='Timecard Report')||r[0]?.trim()==='Pay Period'))return null;
 const out:Timecard['rows']=[],open:Timecard['open']=[];let name='',date='';
 for(const r of rows){
  const c0=(r[0]||'').trim(),c1=(r[1]||'').trim(),c2=(r[2]||'').trim(),c3=(r[3]||'').trim();
  // 이름 뒤 괄호 안 번호는 출근기계 자체 번호라 직원 ID 와 다릅니다. 이름으로만 맞춥니다.
  if(c0==='Employee'){name=(r[3]||'').replace(/\s*\(\d+\)\s*$/,'').trim();date='';continue}
  if(c0==='Pay Period'||c0==='Date'||c0==='Total Hours')continue;
  if(/^\d{8}$/.test(c1))date=c1.slice(0,4)+'-'+c1.slice(4,6)+'-'+c1.slice(6);
  const start=hhmm(c2);
  if(!name||!date||!start)continue;
  const end=hhmm(c3);
  if(end)out.push({name,date,start,end});else open.push({name,date,start});
 }
 return {rows:out,open};
}
export function mapRows(rows:string[][],mapping:Record<string,string>):Omit<Attendance,'id'>[]{for(const key of ['employeeId','date','start','end'])if(mapping[key]===undefined||mapping[key]==='')throw new Error('필수 열을 연결하세요.');return rows.slice(1).map((r,i)=>{const date=(r[Number(mapping.date)]||'').replaceAll('/','-');const result={employeeId:r[Number(mapping.employeeId)]||'',date,start:r[Number(mapping.start)]||'',end:r[Number(mapping.end)]||'',breakMinutes:mapping.breakMinutes===''?0:Number(r[Number(mapping.breakMinutes)]||0)};if(!result.employeeId||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(result.start)||!/^\d{2}:\d{2}$/.test(result.end))throw new Error(`${i+2}행: 직원 ID, 날짜(YYYY-MM-DD), 시간(HH:mm)을 확인하세요.`);return result})}
// Headers follow the viewer's language; the import screen matches Korean or English headers.
export async function downloadTemplate(tr:(text:string)=>string=text=>text){const ExcelJS=await import('exceljs');const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet(tr('출근기록'));ws.addRow(fields.map(f=>tr(f[1])));ws.addRow(['E001','2026-09-14','09:00','17:00',30]);ws.columns.forEach(c=>c.width=20);const bytes=await wb.xlsx.writeBuffer();download(new Blob([bytes]),tr('출근기록_양식.xlsx'))}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
