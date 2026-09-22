// 공용 단말(출퇴근 전용 화면)이 쓰는 입구입니다.
// 기기는 관리자 계정으로 한 번 로그인해 두고, 그 뒤로는 직원이 Punch ID 로 본인을 밝힙니다.
// 돌려주는 값은 그 직원 한 사람 몫뿐입니다 — 명부 전체를 공용 기기에 내려보내지 않습니다.
// 이 길에는 visible() 이 없습니다. 무엇을 내보낼지 snapshot() 이 직접 정하니, 고칠 때 함께 살피세요.
import {env} from '@/lib/db';
import {applyCommand} from '@/lib/operations';
import {context,json,sameOrigin} from '@/lib/workspace';
import {LOCATION,PAY_PERIOD_DAYS,addDays,localDate,payPeriodStart,type State} from '@/lib/domain';
import {photoBytes} from '@/lib/punch-photo';
export const dynamic='force-dynamic';
// 없는 번호와 틀린 번호를 같은 말로 돌려보냅니다. 번호를 훑어 누가 있는지 알아내지 못하도록.
const WRONG='Punch ID가 맞지 않습니다.';
const NO_PHOTO='사진이 찍히지 않아 출퇴근을 기록하지 않았습니다. 카메라를 확인하고 다시 눌러주세요.';
const ACTIONS=['punchIn','punchOut','punchBreak'];
// 사진이 붙는 요청이라 본문이 커질 수 있습니다. 읽기 전에 먼저 막습니다.
const MAX_BODY=500_000;
function snapshot(state:State,employeeId:string){
 const e=state.employees.find(x=>x.id===employeeId)!;const today=localDate(new Date());const punches=state.punches??[];
 // 퇴근을 안 찍은 근무가 있으면 그것이 '지금 근무'입니다. 없으면 오늘 마지막으로 찍은 기록을 보여 줍니다.
 const punch=[...punches].reverse().find(p=>p.employeeId===e.id&&!p.out)??[...punches].reverse().find(p=>p.employeeId===e.id&&p.date===today)??null;
 return {location:LOCATION,employee:{id:e.id,name:e.name,color:e.color,role:e.role},
  shifts:state.shifts.filter(s=>s.employeeId===e.id&&s.date===today).sort((a,b)=>a.start.localeCompare(b.start)).map(s=>({id:s.id,start:s.start,end:s.end,area:s.area})),
  punch:punch?{id:punch.id,date:punch.date,in:punch.in,out:punch.out,area:punch.area,breaks:punch.breaks??[],photoAt:punch.photoAt,outPhotoAt:punch.outPhotoAt}:null}}
// 기기 자체가 쓸 수 있는 상태인지만 알려 줍니다. 직원 정보는 아직 오가지 않습니다.
async function gate(req:Request){
 const c=await context(req);
 if(!c)return {error:json({error:'이 기기가 로그인되어 있지 않습니다. 관리자 계정으로 먼저 로그인하세요.'},401)};
 if(!c.row||!c.state)return {error:json({error:'워크스페이스를 먼저 생성하세요.'},400)};
 if(!c.actor.admin)return {error:json({error:'관리자 계정으로 로그인된 기기에서만 쓸 수 있습니다.'},403)};
 return {c}}
export async function GET(req:Request){try{const {error}=await gate(req);if(error)return error;return json({location:LOCATION})}catch(e){return json({error:e instanceof Error?e.message:'불러오지 못했습니다.'},403)}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'허용되지 않은 요청입니다.'},403);
 if(Number(req.headers.get('content-length')||0)>MAX_BODY)return json({error:'사진이 너무 큽니다. 다시 찍어주세요.'},413);
 const {c,error}=await gate(req);if(error||!c)return error!;
 const body=await req.json() as {punchId?:unknown;action?:unknown;breakAction?:unknown;photo?:unknown};
 const punchId=typeof body.punchId==='string'?body.punchId.trim():'';
 if(!/^\d{4,8}$/.test(punchId))return json({error:WRONG},400);
 const employee=c.state!.employees.find(e=>!e.archived&&e.punchId===punchId);
 if(!employee)return json({error:WRONG},400);
 const action=typeof body.action==='string'?body.action:'';
 if(!action)return json(snapshot(c.state!,employee.id));
 if(!ACTIONS.includes(action))return json({error:'지원하지 않는 요청입니다.'},400);
 const needsPhoto=action==='punchIn'||action==='punchOut';
 const photo=needsPhoto?photoBytes(body.photo):null;
 // 사진이 없거나 사진이 아니면 여기서 끝냅니다. 기록은 남지 않습니다.
 if(needsPhoto&&!photo)return json({error:NO_PHOTO},400);
 const now=new Date(),today=localDate(now);
 const payload:Record<string,string>={employeeId:employee.id,punchId};
 if(photo)payload.photoAt=now.toISOString();
 if(action==='punchBreak'){payload.action=body.breakAction==='end'?'end':'start';payload.paid='1'}
 const next=applyCommand(c.state!,{type:action,payload},c.actor,now);
 // 단말은 문서를 고치는 것이 아니라 기록 하나를 덧붙일 뿐이라, 화면이 오래 열려 있어도 막히지 않게
 // 클라이언트가 보낸 번호 대신 지금 저장된 번호를 그대로 씁니다.
 const saved=await env.DB.prepare('UPDATE workspaces SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(next),c.team,c.row!.version).run();
 if(saved.meta.changes!==1)return json({error:'동시에 다른 변경이 있었습니다. 잠시 후 다시 눌러주세요.'},409);
 if(photo){
  // 사진은 기록이 남은 뒤에 붙입니다. 사진 저장이 실패해도 찍힌 출퇴근은 그대로 남습니다.
  const target=(next.punches??[]).filter(p=>p.employeeId===employee.id).at(-1);
  if(target){
   await env.DB.prepare('INSERT INTO punch_photos (punch_id,kind,workspace,taken_on,photo) VALUES (?,?,?,?,?) ON CONFLICT (punch_id,kind) DO UPDATE SET taken_on=excluded.taken_on, photo=excluded.photo')
    .bind(target.id,action==='punchIn'?'in':'out',c.team,today,photo).run().catch(()=>0);
   // 지지난 급여 기간보다 오래된 사진은 함께 지웁니다.
   const keepFrom=addDays(payPeriodStart(today),-2*PAY_PERIOD_DAYS);
   await env.DB.prepare('DELETE FROM punch_photos WHERE workspace = ? AND taken_on < ?').bind(c.team,keepFrom).run().catch(()=>0)}}
 return json(snapshot(next,employee.id))}
 catch(e){return json({error:e instanceof Error?e.message:'저장하지 못했습니다.'},400)}}
