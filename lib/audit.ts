import {env} from '@/lib/db';
import type {State} from '@/lib/domain';
import type {Actor} from '@/lib/operations';

// 활동 로그. activity_log 표에 쌓기만 하고, 고치거나 지우는 코드는 어디에도 두지 않습니다(마이그레이션의 트리거가 막습니다).
// kind — command: 워크스페이스를 바꾼 명령(작업 지시·삭제 포함), app: 앱을 열고 화면을 옮긴 것,
// auth: 로그인·로그아웃·비밀번호 변경, backup: 엑셀 백업·로그 내려받기·복구.
export type LogKind='command'|'app'|'auth'|'backup';
export type LogEntry={workspace:string;actor:Actor;state?:State|null;name?:string;kind:LogKind;action:string;target?:string;detail?:unknown};
export type LogRow={id:string;at:string;actor:string;actor_name:string|null;admin:number;kind:string;action:string;target:string|null;detail:unknown;ip:string|null;user_agent:string|null};

const clip=(v:string|null|undefined,max:number)=>v?v.slice(0,max):null;
// 관리자 계정(admin)은 직원 명부에 없으므로 환경변수의 이름을 씁니다 — birth-auth 의 ADMINS 와 같은 값입니다.
const nameOf=(state:State|null|undefined,actor:Actor)=>state?.employees.find(e=>e.id===actor.id)?.name??(actor.id==='admin'?process.env.ADMIN_NAME||'관리자':null);

// 기다려야 하는 자리(복구 직전 모습 남기기)에서 부릅니다. 실패하면 그대로 던집니다.
export async function writeLog(req:Request|null,e:LogEntry){
 const ip=req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req?.headers.get('x-real-ip')||null;
 await env.DB.prepare('INSERT INTO activity_log (workspace, actor, actor_name, admin, kind, action, target, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)')
  .bind(e.workspace,e.actor.id,clip(e.name??nameOf(e.state,e.actor),120),e.actor.admin?1:0,e.kind,clip(e.action,60)!,clip(e.target,300),e.detail===undefined?null:JSON.stringify(e.detail),clip(ip,60),clip(req?.headers.get('user-agent'),400))
  .run().catch(error=>{throw logMissing(error)});
}
// 보통의 기록. 로그를 남기지 못했다고 직원의 일을 막지는 않고, 서버 로그에만 남깁니다.
export const log=(req:Request|null,e:LogEntry)=>writeLog(req,e).catch(error=>console.error('activity_log 기록 실패',error));
// 표를 아직 만들지 않았으면(42P01) 무엇을 해야 하는지 알려 줍니다.
export const logMissing=(error:unknown)=>(error as {code?:string})?.code==='42P01'?Error('활동 로그 표가 없습니다. supabase/migrations/20260925120000_activity_log.sql 을 먼저 실행하세요.'):error;

// 최근 것부터 limit 줄. from/to 는 YYYY-MM-DD(클럽 날짜가 아니라 UTC 기준)입니다.
export async function readLogs(workspace:string,limit:number,from='',to=''){
 const where=['workspace = ?'],params:(string|number)[]=[workspace];
 if(from){where.push('at >= ?::date');params.push(from)}
 if(to){where.push("at < (?::date + interval '1 day')");params.push(to)}
 const {results}=await env.DB.prepare(`SELECT id::text AS id, at::text AS at, actor, actor_name, admin, kind, action, target, detail, ip, user_agent FROM activity_log WHERE ${where.join(' AND ')} ORDER BY at DESC, id DESC LIMIT ${Math.max(1,Math.floor(limit))}`).bind(...params).all<LogRow>().catch(error=>{throw logMissing(error)});
 return results;
}

// 명령 한 번이 워크스페이스에서 무엇을 늘리고, 지우고, 바꿨는지 목록마다 적습니다.
// 지운 기록은 지우기 전 모습 그대로 남으므로, 데이터에서 빠진 것도 로그에서는 찾을 수 있습니다.
// publishedShifts 는 공개할 때마다 근무표 전체가 바뀌어 적지 않습니다 — 공개 자체는 action 으로 남습니다.
const TRACKED=['employees','shifts','swaps','attendance','messages','tasks','todos','todoTemplates','carts','timeOff','availability','punches','clockNames','payHours','managerPay'] as const;
const keyOf=(x:Record<string,unknown>)=>typeof x.id==="string"?x.id:typeof x.name==="string"?x.name:JSON.stringify(x);
export function commandDetail(payload:unknown,before:State,after:State){
 const clean=payload&&typeof payload==='object'?{...(payload as Record<string,unknown>)}:payload;
 if(clean&&typeof clean==='object')delete (clean as Record<string,unknown>).photo;
 const added:Record<string,unknown[]>={},removed:Record<string,unknown[]>={},changed:Record<string,{before:unknown;after:unknown}[]>={};
 for(const list of TRACKED){
  const was=new Map(((before[list]??[]) as Record<string,unknown>[]).map(x=>[keyOf(x),x]));
  const now=new Map(((after[list]??[]) as Record<string,unknown>[]).map(x=>[keyOf(x),x]));
  for(const [k,x] of now){const old=was.get(k);if(!old)(added[list]??=[]).push(x);else if(JSON.stringify(old)!==JSON.stringify(x))(changed[list]??=[]).push({before:old,after:x})}
  for(const [k,x] of was)if(!now.has(k))(removed[list]??=[]).push(x);
 }
 const settings:Record<string,{before:unknown;after:unknown}>={};
 for(const k of ['currency','workplace','areas'] as const)if(JSON.stringify(before[k])!==JSON.stringify(after[k]))settings[k]={before:before[k]??null,after:after[k]??null};
 return {payload:clean,added,removed,changed,...(Object.keys(settings).length?{settings}:{})};
}
// 로그 목록에서 한눈에 알아보도록, 명령이 가리키는 사람이나 작업을 짧게 적습니다.
export function commandTarget(payload:Record<string,unknown>|undefined,state:State){
 const p=payload??{};
 const task=typeof p.id==='string'?state.tasks?.find(x=>x.id===p.id):undefined;
 if(task)return `${task.title} → ${state.employees.find(e=>e.id===task.assignedTo)?.name??task.assignedTo}`;
 const who=[p.employeeId,p.assignedTo,p.id].find(v=>typeof v==='string'&&state.employees.some(e=>e.id===v)) as string|undefined;
 if(who){const name=state.employees.find(e=>e.id===who)!.name;return typeof p.title==='string'?`${p.title} → ${name}`:name}
 if(typeof p.title==='string')return p.title;
 return typeof p.id==='string'?p.id:undefined;
}

// 지나온 자리(staff_location_log). 30분마다 한 줄이 쌓입니다 — app/api/location 이 씁니다.
export type GpsRow={at:string;actor:string;actor_name:string|null;lat:number;lng:number;accuracy:number|null};
// 로그 엑셀의 GPS 시트가 읽습니다. 표를 아직 만들지 않았으면 빈 목록을 돌려, 활동 로그 내려받기는 막지 않습니다.
export async function readGpsLog(workspace:string,limit:number,from='',to=''){
 const where=['workspace = ?'],params:(string|number)[]=[workspace];
 if(from){where.push('at >= ?::date');params.push(from)}
 if(to){where.push("at < (?::date + interval '1 day')");params.push(to)}
 const {results}=await env.DB.prepare(`SELECT at::text AS at, actor, actor_name, lat, lng, accuracy FROM staff_location_log WHERE ${where.join(' AND ')} ORDER BY at DESC, id DESC LIMIT ${Math.max(1,Math.floor(limit))}`).bind(...params).all<GpsRow>().catch(error=>{if((error as {code?:string})?.code==='42P01')return {results:[] as GpsRow[]};throw error});
 return results;
}
