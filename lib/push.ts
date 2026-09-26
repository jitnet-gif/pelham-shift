import {env} from '@/lib/db';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {type Shift,type State,OT_PERIOD_HOURS,PAY_PERIOD_DAYS,dueShifts,missedShifts,overtimeWorked,overtimeAdded,payPeriodStart} from './domain';
import {rosterAdminIds} from './birth-auth';
import {translate,isLang,SCREEN_LANG,type Vars} from './i18n';
// link: 알림을 눌렀을 때 앱 주소 뒤에 붙일 값. 누르면 곧장 그 화면이 열립니다.
export type Note={title:string;body:string;tag?:string;vars?:Vars;link?:Record<string,string>};
type Keys={publicKey:string;privateKey:string;tickKey:string};
type Sub={endpoint:string;member:string;p256dh:string;auth:string;lang:string};
const b64url=(bytes:ArrayBuffer|Uint8Array)=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};
const selectKeys='SELECT public_key AS "publicKey", private_key AS "privateKey", tick_key AS "tickKey" FROM push_keys WHERE workspace = ?';
// VAPID keys live in the database per workspace, so the deploy needs no secret configuration.
export async function pushKeys(workspace:string):Promise<Keys>{const found=await env.DB.prepare(selectKeys).bind(workspace).first<Keys>();if(found)return found;const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']) as CryptoKeyPair;const raw=await crypto.subtle.exportKey('raw',pair.publicKey) as ArrayBuffer;const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey) as JsonWebKey;await env.DB.prepare('INSERT INTO push_keys (workspace,public_key,private_key,tick_key) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(workspace,b64url(raw),jwk.d,b64url(crypto.getRandomValues(new Uint8Array(24)))).run();return (await env.DB.prepare(selectKeys).bind(workspace).first<Keys>())!}
// Each device keeps the language it subscribed with, so its notifications arrive in the language its owner reads.
export async function subscribe(workspace:string,member:string,value:unknown,lang?:unknown){const v=value as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}}|null;const ok=(x:unknown,max:number):x is string=>typeof x==='string'&&x.length>0&&x.length<=max;if(!ok(v?.endpoint,1000)||!v.endpoint.startsWith('https://')||!ok(v.keys?.p256dh,200)||!ok(v.keys?.auth,100))throw new Error('알림 구독 정보를 확인하세요.');await env.DB.prepare('INSERT INTO push_subscriptions (endpoint,workspace,member,p256dh,auth,created_at,lang) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET workspace=excluded.workspace, member=excluded.member, p256dh=excluded.p256dh, auth=excluded.auth, created_at=excluded.created_at, lang=excluded.lang').bind(v.endpoint,workspace,member,v.keys.p256dh,v.keys.auth,new Date().toISOString(),isLang(lang)?lang:'en').run()}
export async function unsubscribe(workspace:string,member:string,endpoint:unknown){await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND workspace = ? AND member = ?').bind(typeof endpoint==='string'?endpoint:'',workspace,member).run()}
export async function notify(workspace:string,members:string[],note:Note,origin:string){const targets=new Set(members);const subs=(await env.DB.prepare('SELECT endpoint,member,p256dh,auth,lang FROM push_subscriptions WHERE workspace = ?').bind(workspace).all<Sub>()).results.filter(s=>targets.has(s.member));if(!subs.length)return 0;const keys=await pushKeys(workspace);const vapid={subject:origin.startsWith('https://')?origin:'mailto:notifications@pelham-shift.invalid',publicKey:keys.publicKey,privateKey:keys.privateKey};const url='/?'+new URLSearchParams({team:workspace,...note.link});// 알림도 화면과 같은 말로 갑니다. 기기마다 저장된 lang 은 언어 고르기가 돌아올 때를 위해 그대로 둡니다.
 const results=await Promise.allSettled(subs.map(async s=>{const lang=SCREEN_LANG;const data=JSON.stringify({title:translate(lang,note.title,note.vars),body:translate(lang,note.body,note.vars),tag:note.tag,url});const res=await fetch(s.endpoint,await buildPushPayload({data,options:{ttl:3600,urgency:'high'}},{endpoint:s.endpoint,expirationTime:null,keys:{p256dh:s.p256dh,auth:s.auth}},vapid));if(res.status===404||res.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run();return res.ok}));return results.filter(r=>r.status==='fulfilled'&&r.value).length}
// Each shift start is claimed in push_sent before sending, so concurrent polls and cron ticks never double-send.
// A claim whose send reached no device is released, so the next poll retries (e.g. the employee enables push later).
// The claim id carries which of the two messages it is, so the missed-check-in notice is not mistaken for the reminder already sent.
async function once(workspace:string,id:string,members:string[],note:Note,origin:string,now:Date){const claim=await env.DB.prepare('INSERT INTO push_sent (id,workspace,sent_at) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(id,workspace,now.toISOString()).run();if(claim.meta.changes!==1)return 0;const n=await notify(workspace,members,note,origin).catch(()=>0);if(!n)await env.DB.prepare('DELETE FROM push_sent WHERE id = ?').bind(id).run();return n}
const claimed=(workspace:string,s:Shift,kind:string,note:Note,origin:string,now:Date)=>once(workspace,`${workspace}:${s.id}:${s.employeeId}:${s.date}T${s.start}${kind}`,[s.employeeId],note,origin,now);
// 근무마다 최대 두 번입니다 — 시작 1시간 전에 한 번, 그러고도 출근이 찍히지 않으면 한 번 더.
// 이미 출근을 찍은 사람은 두 창 모두에서 빠지므로 알림이 가지 않습니다.
export async function remind(workspace:string,state:State,origin:string,now=new Date()){let sent=0;
 const vars=(s:Shift)=>({date:s.date.slice(5).replace('-','/'),start:s.start,area:s.area});
 for(const s of dueShifts(state,now)) sent+=await claimed(workspace,s,'',{title:'출근 1시간 전 알림',body:'{date} {start} · {area} 근무가 1시간 이내에 시작됩니다.',vars:vars(s),tag:'shift-'+s.id},origin,now);
 for(const s of missedShifts(state,now)) sent+=await claimed(workspace,s,':missed',{title:'출근 기록이 아직 없습니다',body:'{start} · {area} 근무가 시작됐는데 출근이 찍히지 않았습니다. 출퇴근 화면에서 출근을 찍어 주세요.',vars:vars(s),tag:'missed-'+s.id},origin,now);
 // 급여 기간(2주) 88시간을 넘긴 직원은 관리자에게 알립니다. 누르면 그 직원의 출근 기록이 그 급여 기간으로 열립니다. 사람마다 그 기간에 한 번뿐입니다 — 보낸 기록의 키가 그 기간의 첫 일요일을 품습니다.
 // 보낸 기록은 한 급여 기간(14일)이 지나야 치웁니다. 더 일찍 치우면 같은 기간 안에서 알림이 다시 갑니다.
 const admins=adminsOf(state);
 for(const o of overtimeWorked(state,now)) sent+=await once(workspace,`${workspace}:ot:${o.employee.id}:${o.week}`,admins,{title:'급여 기간 {w}시간 초과',body:'{name}: 이번 급여 기간 {hours}시간 일했습니다. 초과 근무 수당이 붙습니다. 눌러서 근무 시간을 확인하세요.',vars:{w:OT_PERIOD_HOURS,name:o.employee.name,hours:o.hours.toFixed(1)},tag:'overtime-'+o.employee.id,link:{open:'attendance',who:o.employee.id,from:payPeriodStart(o.week)}},origin,now);
 if(sent)await env.DB.prepare('DELETE FROM push_sent WHERE workspace = ? AND sent_at < ?').bind(workspace,new Date(now.getTime()-PAY_PERIOD_DAYS*86400000).toISOString()).run();return sent}
const adminsOf=(state:State)=>[...rosterAdminIds(),...state.employees.filter(e=>e.admin&&!e.archived).map(e=>e.id)];
// 근무를 넣거나 고쳐 급여 기간(2주) 88시간을 넘기게 되면, 저장하는 그 순간 관리자에게 알립니다. 누르면 그 직원의 출근 기록이 열립니다.
// 저장한 사람 본인에게는 보내지 않습니다 — 방금 스스로 낸 근무라 알릴 것이 없습니다.
export async function overtimeScheduled(workspace:string,before:State,after:State,actor:string,origin:string){
 const admins=adminsOf(after).filter(id=>id!==actor);if(!admins.length)return 0;let sent=0;
 const who=after.employees.find(e=>e.id===actor)?.name||'Admin';
 for(const o of overtimeAdded(before.shifts,after.shifts)){const e=after.employees.find(x=>x.id===o.employeeId);if(!e)continue;
  sent+=await notify(workspace,admins,{title:'급여 기간 {w}시간 넘는 근무 편성',body:'{who}님이 {name}의 {week} 시작 급여 기간 근무를 {hours}시간으로 짰습니다. 눌러서 출근 기록을 확인하세요.',vars:{w:OT_PERIOD_HOURS,who,name:e.name,week:o.week.slice(5).replace('-','/'),hours:o.hours.toFixed(1)},tag:'ot-plan-'+e.id+'-'+o.week,link:{open:'attendance',who:e.id,from:payPeriodStart(o.week)}},origin).catch(()=>0)}
 return sent}
// 완전히 삭제한 직원에게는 알림이 갈 곳이 없습니다. 기기 등록을 함께 지웁니다.
export async function forgetPush(workspace:string,member:string){await env.DB.prepare('DELETE FROM push_subscriptions WHERE workspace = ? AND member = ?').bind(workspace,member).run()}
