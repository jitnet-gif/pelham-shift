import {after} from 'next/server';
import {env} from '@/lib/db';
import {seed,PAY_PERIOD_DAYS,addDays,distanceMeters,localDate,payPeriodStart} from '@/lib/domain';
import {photoBytes} from '@/lib/punch-photo';
import {applyCommand,type Command} from '@/lib/operations';
import {context,visible,json,sameOrigin} from '@/lib/workspace';
import {notify,remind} from '@/lib/push';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);if(!c.row)return json({setup:true,team:c.user.userId,actor:c.actor,authMethod:c.authMethod,passwordChanged:c.passwordChanged});after(()=>remind(c.team,c.state!,new URL(req.url).origin).catch(()=>0));return json({state:visible(c.state!,c.actor),version:c.row.version,team:c.team,actor:c.actor,authMethod:c.authMethod,passwordChanged:c.passwordChanged})}catch(e){return json({error:e instanceof Error?e.message:'불러오지 못했습니다.'},403)}}
export async function POST(req:Request){try{if(!sameOrigin(req))return json({error:'허용되지 않은 요청입니다.'},403);if(Number(req.headers.get('content-length')||0)>1500000)return json({error:'요청이 너무 큽니다.'},413);const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);const body=await req.json() as Command&{version?:number};if(body.type==='initialize'){if(c.row||c.team!==c.user.userId)return json({error:'이미 생성되었거나 권한이 없습니다.'},409);const state=seed();state.shifts=[];state.punches=[];await env.DB.prepare('INSERT INTO workspaces (id,owner,state,version) VALUES (?,?,?,1)').bind(c.user.userId,c.user.userId,JSON.stringify(state)).run();return json({state,version:1,team:c.user.userId,actor:c.actor})}if(!c.row||!c.state)return json({error:'워크스페이스를 먼저 생성하세요.'},400);if(body.version!==c.row.version)return json({error:'다른 사용자가 변경했습니다. 새로고침 후 다시 시도하세요.'},409);
 // 출근·퇴근은 그 자리에서 찍은 사진이 있어야만 기록됩니다. 없거나 사진이 아니면 여기서 끝냅니다.
 const needsPhoto=body.type==='punchIn'||body.type==='punchOut';
 const photo=needsPhoto?photoBytes((body.payload as {photo?:unknown})?.photo):null;
 if(needsPhoto&&!photo)return json({error:'사진이 찍히지 않아 출퇴근을 기록하지 않았습니다. 카메라를 확인하고 다시 눌러주세요.'},400);
 // 출퇴근 자리를 지정해 두었으면, 그 자리 가까이에서 찍은 것인지 함께 봅니다.
 const place=c.state.workplace;
 if(needsPhoto&&place){
  const p=body.payload as {lat?:unknown;lng?:unknown};
  const lat=Number(p?.lat),lng=Number(p?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)
   return json({error:'위치를 확인하지 못해 출퇴근을 기록하지 않았습니다. 위치 권한을 허용하고 다시 눌러주세요.'},400);
  const away=Math.round(distanceMeters(place,{lat,lng}));
  if(away>place.radius)
   return json({error:`근무지에서 약 ${away}m 떨어져 있어 출퇴근을 기록하지 않았습니다. 근무지에서 다시 눌러주세요.`},400)}
 // 사진 자체는 state 에 넣지 않습니다 — 찍힌 시각만 남고 사진은 punch_photos 표로 갑니다.
 if(photo){const p=body.payload as Record<string,unknown>;delete p.photo;delete p.lat;delete p.lng;delete p.accuracy;p.photoAt=new Date().toISOString()}
 const state=applyCommand(c.state,body,c.actor);const result=await env.DB.prepare('UPDATE workspaces SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(state),c.team,c.row.version).run();if(result.meta.changes!==1)return json({error:'동시 변경이 감지되었습니다. 다시 불러오세요.'},409);
 if(photo){
  // 사진은 기록이 남은 뒤에 붙입니다. 사진 저장이 실패해도 찍힌 출퇴근은 그대로 남습니다.
  const today=localDate(new Date());
  const target=(state.punches??[]).filter(p=>p.employeeId===c.actor.id).at(-1);
  if(target){
   await env.DB.prepare('INSERT INTO punch_photos (punch_id,kind,workspace,taken_on,photo) VALUES (?,?,?,?,?) ON CONFLICT (punch_id,kind) DO UPDATE SET taken_on=excluded.taken_on, photo=excluded.photo')
    .bind(target.id,body.type==='punchIn'?'in':'out',c.team,today,photo).run().catch(()=>0);
   // 지지난 급여 기간보다 오래된 사진은 함께 지웁니다.
   await env.DB.prepare('DELETE FROM punch_photos WHERE workspace = ? AND taken_on < ?')
    .bind(c.team,addDays(payPeriodStart(today),-2*PAY_PERIOD_DAYS)).run().catch(()=>0)}}if(body.type==='message'){const m=state.messages.at(-1);const to=m?.to==='all'?state.employees.map(e=>e.id):[m?.to||''];after(()=>notify(c.team,to.filter(id=>id&&id!==c.actor.id),{title:c.actor.admin?'관리자 메시지':'직원 메시지',body:(c.actor.admin?'':(state.employees.find(e=>e.id===c.actor.id)?.name||'')+': ')+(m?.body||''),tag:'message'},new URL(req.url).origin).catch(()=>0))}if(body.type==='rain'){const m=state.messages.at(-1);after(()=>notify(c.team,m?.recipients??state.employees.map(e=>e.id),{title:'우천 근무 종료',body:m?.body||'',tag:'rain'},new URL(req.url).origin).catch(()=>0))}return json({state:visible(state,c.actor),version:c.row.version+1,team:c.team,actor:c.actor})}catch(e){return json({error:e instanceof Error?e.message:'저장하지 못했습니다.'},400)}}
