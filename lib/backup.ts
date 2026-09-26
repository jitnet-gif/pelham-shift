import ExcelJS from 'exceljs';
import type {State} from './domain';
import type {LogRow} from './audit';

// 엑셀 백업과 복구. 워크스페이스 전체(state)를 목록마다 시트 하나로 풀어 적고, 같은 파일을 그대로 읽어 되돌립니다.
// 시트 1행은 열 이름, 2행은 그 열의 값 종류(string·number·boolean·json)입니다. 3행부터가 기록입니다.
// 종류 줄이 있어 '1001' 같은 번호가 숫자로, 휴게·위치 같은 묶음 값이 글자로 바뀌지 않고 그대로 돌아옵니다.
// 활동 로그 시트는 보는 용도입니다. 복구는 로그를 읽지도 고치지도 않습니다.
export const BACKUP_FORMAT='pelham-shift-backup/1';
export const LISTS=['employees','shifts','publishedShifts','swaps','attendance','messages','tasks','timeOff','availability','punches','clockNames'] as const;
const INFO='Info',SETTINGS='Settings',LOG='Log (read-only)';
// 백업 파일에 싣는 로그는 최근 것부터 이만큼이고, detail 은 앞부분만 싣습니다 — 백업이 복구 한도(4MB)를 넘지 않게.
// 전체 로그와 detail 전문은 '활동 로그 내려받기'로 기간을 골라 받습니다. 복구는 로그 시트를 읽지 않습니다.
export const BACKUP_LOG_ROWS=10000;
const BACKUP_DETAIL=1000;
// 엑셀 한 칸에 들어가는 글자 수의 한계입니다(32,767).
const CELL_MAX=32000;

type Kind='string'|'number'|'boolean'|'json';
type Row=Record<string,unknown>;
// 한 열의 값이 모두 같은 원시 종류면 그 종류로, 섞였거나 묶음(배열·객체·null)이면 json 으로 적습니다.
function kindOf(values:unknown[]):Kind{
 const kinds=new Set(values.filter(v=>v!==undefined).map(v=>v===null||typeof v==='object'?'json':typeof v));
 if(kinds.size===1){const [k]=kinds;if(k==='string'||k==='number'||k==='boolean')return k}
 return kinds.size?'json':'string';
}
const header=(sheet:ExcelJS.Worksheet)=>{const r=sheet.getRow(1);r.font={bold:true};const k=sheet.getRow(2);k.font={italic:true,color:{argb:'FF888888'}};sheet.views=[{state:'frozen',ySplit:2}]};

function writeList(book:ExcelJS.Workbook,name:string,rows:Row[]){
 const sheet=book.addWorksheet(name);
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 if(!keys.length){sheet.addRow(['id']);sheet.addRow(['string']);header(sheet);return}
 const kinds=keys.map(k=>kindOf(rows.map(r=>r[k])));
 sheet.addRow(keys);sheet.addRow(kinds);
 for(const r of rows)sheet.addRow(keys.map((k,i)=>{const v=r[k];if(v===undefined)return null;return kinds[i]==='json'?JSON.stringify(v):v}));
 header(sheet);
 sheet.columns.forEach((c,i)=>{c.width=Math.min(40,Math.max(10,keys[i].length+2))});
}

export async function buildBackup(state:State,info:{workspace:string;version:number},logs:LogRow[]){
 const book=new ExcelJS.Workbook();book.created=new Date();book.creator='Pelham Shift';
 const at=new Date().toISOString();
 const infoSheet=book.addWorksheet(INFO);
 infoSheet.addRow(['key','value']);
 for(const [k,v] of [['format',BACKUP_FORMAT],['workspace',info.workspace],['version',info.version],['exportedAt',at],['note','이 파일을 그대로 올리면 이 시점으로 복구됩니다. 1행(열 이름)과 2행(값 종류)은 고치지 마세요.']] as const)infoSheet.addRow([k,v]);
 for(const list of LISTS)infoSheet.addRow(['count:'+list,state[list]?.length??'(없음)']);
 infoSheet.getRow(1).font={bold:true};infoSheet.getColumn(1).width=22;infoSheet.getColumn(2).width=60;
 // 목록 밖의 값(통화·근무지·업무 목록·공개 여부 등)은 이름과 JSON 한 줄씩입니다. 없는 값은 줄 자체를 두지 않습니다.
 const settings=book.addWorksheet(SETTINGS);settings.addRow(['key','json']);
 for(const [k,v] of Object.entries(state))if(!(LISTS as readonly string[]).includes(k)&&v!==undefined)settings.addRow([k,JSON.stringify(v)]);
 settings.getRow(1).font={bold:true};settings.getColumn(1).width=22;settings.getColumn(2).width=60;
 // publishedShifts 처럼 없는 것과 빈 목록이 다른 뜻인 경우가 있어, 워크스페이스에 있던 목록을 따로 적어 둡니다.
 settings.addRow(['__lists',JSON.stringify(LISTS.filter(l=>state[l]!==undefined))]);
 for(const list of LISTS)writeList(book,list,(state[list]??[]) as Row[]);
 const log=book.addWorksheet(LOG);
 log.addRow(['at','actor','actor_name','admin','kind','action','target','detail','ip','user_agent']);
 for(const r of logs)log.addRow([r.at,r.actor,r.actor_name,r.admin?'Y':'',r.kind,r.action,r.target,r.detail==null?'':JSON.stringify(r.detail).slice(0,BACKUP_DETAIL),r.ip,r.user_agent]);
 log.getRow(1).font={bold:true};log.views=[{state:'frozen',ySplit:1}];
 return Buffer.from(await book.xlsx.writeBuffer());
}

// 로그만 담은 파일. 백업의 로그 시트와 같은 모양입니다.
export async function buildLogBook(logs:LogRow[]){
 const book=new ExcelJS.Workbook();book.created=new Date();
 const log=book.addWorksheet(LOG);
 log.addRow(['at','actor','actor_name','admin','kind','action','target','detail','ip','user_agent']);
 for(const r of logs)log.addRow([r.at,r.actor,r.actor_name,r.admin?'Y':'',r.kind,r.action,r.target,r.detail==null?'':JSON.stringify(r.detail).slice(0,CELL_MAX),r.ip,r.user_agent]);
 log.getRow(1).font={bold:true};log.views=[{state:'frozen',ySplit:1}];
 [22,14,16,6,9,16,30,80,16,30].forEach((w,i)=>{log.getColumn(i+1).width=w});
 return Buffer.from(await book.xlsx.writeBuffer());
}

// 엑셀이 돌려주는 칸 값을 평범한 값으로 폅니다. 서식 글자·수식 결과·하이퍼링크를 글자로 바꿉니다.
function plain(v:ExcelJS.CellValue):unknown{
 if(v===null||v===undefined)return undefined;
 if(v instanceof Date)return v;
 if(typeof v==='object'){
  if('richText' in v)return v.richText.map(r=>r.text).join('');
  if('result' in v)return plain(v.result as ExcelJS.CellValue);
  if('text' in v)return String(v.text);
  if('error' in v)return undefined;
  return undefined;
 }
 return v;
}
const pad=(n:number)=>String(n).padStart(2,'0');
// 엑셀에서 손으로 고치면 날짜·시각 글자가 날짜 값으로 바뀌어 옵니다. 앱이 쓰는 글자 모양으로 되돌립니다.
function dateText(d:Date){
 if(d.getUTCFullYear()<=1900)return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
 if(!d.getUTCHours()&&!d.getUTCMinutes()&&!d.getUTCSeconds()&&!d.getUTCMilliseconds())return d.toISOString().slice(0,10);
 return d.toISOString();
}
// 칸 값을 글자로. plain() 이 돌려줄 수 있는 것은 글자·숫자·참거짓·날짜뿐입니다.
const str=(v:unknown)=>v===undefined||v===null?'':v instanceof Date?dateText(v):typeof v==='object'?JSON.stringify(v):String(v as string|number|boolean);
function coerce(v:unknown,kind:string,where:string):unknown{
 if(v===undefined)return undefined;
 switch(kind){
  case 'number':{if(v==='')return undefined;const n=typeof v==='number'?v:Number(v);if(!Number.isFinite(n))throw Error(`${where}: 숫자가 아닙니다.`);return n}
  case 'boolean':return v===true||v===1||str(v).toLowerCase()==='true'||v==='1';
  case 'json':{if(v==='')return undefined;try{return JSON.parse(v instanceof Date?JSON.stringify(v):str(v))}catch{throw Error(`${where}: 값을 읽지 못했습니다.`)}}
  default:return str(v);
 }
}
function readList(sheet:ExcelJS.Worksheet):Row[]{
 const keys:string[]=[],kinds:string[]=[];
 sheet.getRow(1).eachCell({includeEmpty:false},(c,col)=>{keys[col]=str(plain(c.value)).trim()});
 sheet.getRow(2).eachCell({includeEmpty:false},(c,col)=>{kinds[col]=str(plain(c.value)).trim()||'string'});
 const rows:Row[]=[];
 sheet.eachRow({includeEmpty:false},(row,n)=>{
  if(n<3)return;
  const r:Row={};
  row.eachCell({includeEmpty:false},(c,col)=>{const k=keys[col];if(!k)return;const v=coerce(plain(c.value),kinds[col]||'string',`${sheet.name} ${n}행 ${k}`);if(v!==undefined)r[k]=v});
  if(Object.keys(r).length)rows.push(r);
 });
 return rows;
}

// 백업 파일을 워크스페이스로 되돌립니다. 모양이 맞지 않으면 아무것도 바꾸지 않고 이유를 던집니다.
export async function readBackup(file:ArrayBuffer):Promise<{state:State;workspace:string;exportedAt:string}>{
 const book=new ExcelJS.Workbook();
 try{await book.xlsx.load(Buffer.from(file) as unknown as ArrayBuffer)}catch{throw Error('엑셀 파일(.xlsx)을 읽지 못했습니다.')}
 const info=book.getWorksheet(INFO),settings=book.getWorksheet(SETTINGS);
 if(!info||!settings)throw Error('Pelham Shift 백업 파일이 아닙니다. 백업으로 받은 파일을 그대로 올리세요.');
 const meta:Record<string,string>={};
 info.eachRow((row,n)=>{if(n>1)meta[str(plain(row.getCell(1).value))]=str(plain(row.getCell(2).value))});
 if(meta.format!==BACKUP_FORMAT)throw Error('Pelham Shift 백업 파일이 아닙니다. 백업으로 받은 파일을 그대로 올리세요.');
 const state:Row={};let present:string[]=[...LISTS];
 settings.eachRow((row,n)=>{
  if(n<2)return;
  const key=str(plain(row.getCell(1).value)).trim(),raw=plain(row.getCell(2).value);
  if(!key||raw===undefined)return;
  let value:unknown;try{value=JSON.parse(str(raw))}catch{throw Error(`Settings 시트의 ${key} 값을 읽지 못했습니다.`)}
  if(key==='__lists'){if(Array.isArray(value))present=value.map(String);return}
  if((LISTS as readonly string[]).includes(key))return;
  state[key]=value;
 });
 for(const list of LISTS){
  const sheet=book.getWorksheet(list);
  if(!present.includes(list)){if(sheet&&sheet.rowCount>2)state[list]=readList(sheet);continue}
  state[list]=sheet?readList(sheet):[];
 }
 // 앱이 반드시 있다고 믿는 칸들입니다. 빠졌으면 여기서 멈춥니다 — 반쯤 망가진 워크스페이스를 저장하지 않습니다.
 const s=state as unknown as State;
 for(const list of ['employees','shifts','swaps','attendance','messages','tasks'] as const)s[list]??=[] as never;
 for(const e of s.employees)if(typeof e.id!=='string'||!e.id||typeof e.name!=='string'||!e.name)throw Error('employees 시트에 id 나 name 이 비어 있는 줄이 있습니다.');
 for(const list of LISTS){const rows=(s[list]??[]) as Row[];const key=list==='clockNames'?'name':'id';const seen=new Set<string>();
  for(const r of rows){const k=r[key];if(typeof k!=='string'||!k)throw Error(`${list} 시트에 ${key} 가 비어 있는 줄이 있습니다.`);if(seen.has(k))throw Error(`${list} 시트에 ${key} 가 겹치는 줄이 있습니다: ${k}`);seen.add(k)}}
 for(const m of s.messages)m.readBy??=[];
 for(const e of s.employees){e.email??='';e.birthDate??='';e.rate??=0}
 for(const t of s.tasks)t.notes??='';
 for(const r of s.timeOff??[])r.reason??='';
 for(const r of s.availability??[])r.note??='';
 s.currency??='CAD';s.published??=false;
 return {state:s,workspace:meta.workspace||'',exportedAt:meta.exportedAt||''};
}
