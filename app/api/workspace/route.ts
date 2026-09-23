import {after} from 'next/server';
import {env} from '@/lib/db';
import {seed,distanceMeters,workplaceOf} from '@/lib/domain';
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
 // 출퇴근은 근무지 가까이에서 찍은 것만 받습니다.
 // 관리자가 자리를 다시 잡지 않았으면 클럽 기본 자리(196 Webber Rd, 반경 1km)를 봅니다.
 const place=workplaceOf(c.state);
 if(needsPhoto){
  const p=body.payload as {lat?:unknown;lng?:unknown};
  const lat=Number(p?.lat),lng=Number(p?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)
   return json({error:'위치를 확인하지 못해 출퇴근을 기록하지 않았습니다. 위치 권한을 허용하고 다시 눌러주세요.'},400);
  const away=Math.round(distanceMeters(place,{lat,lng}));
  if(away>place.radius)
   return json({error:`근무지에서 약 ${away}m 떨어져 있어 출퇴근을 기록하지 않았습니다. 근무지에서 다시 눌러주세요.`},400)}
 // 사진은 그 자리에서 찍었는지 확인하는 데에만 씁니다. 확인이 끝나면 버리고 서버 어디에도 남기지 않습니다.
 // 남는 것은 '언제 찍었는지'와 '어디서 찍었는지'뿐입니다.
 if(photo){const p=body.payload as Record<string,unknown>;delete p.photo;p.photoAt=new Date().toISOString()}
 const state=applyCommand(c.state,body,c.actor);const result=await env.DB.prepare('UPDATE workspaces SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(state),c.team,c.row.version).run();if(result.meta.changes!==1)return json({error:'동시 변경이 감지되었습니다. 다시 불러오세요.'},409);
if(body.type==='message'){const m=state.messages.at(-1);const to=m?.to==='all'?state.employees.map(e=>e.id):[m?.to||''];after(()=>notify(c.team,to.filter(id=>id&&id!==c.actor.id),{title:c.actor.admin?'관리자 메시지':'직원 메시지',body:(c.actor.admin?'':(state.employees.find(e=>e.id===c.actor.id)?.name||'')+': ')+(m?.body||''),tag:'message'},new URL(req.url).origin).catch(()=>0))}if(body.type==='rain'){const m=state.messages.at(-1);after(()=>notify(c.team,m?.recipients??state.employees.map(e=>e.id),{title:'우천 근무 종료',body:m?.body||'',tag:'rain'},new URL(req.url).origin).catch(()=>0))}return json({state:visible(state,c.actor),version:c.row.version+1,team:c.team,actor:c.actor})}catch(e){return json({error:e instanceof Error?e.message:'저장하지 못했습니다.'},400)}}
