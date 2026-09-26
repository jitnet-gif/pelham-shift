import {context,json,sameOrigin} from '@/lib/workspace';
import {log} from '@/lib/audit';
export const dynamic='force-dynamic';

// 직원의 앱 사용 기록. 화면이 열릴 때(open)와 탭을 옮길 때(tab)만 보냅니다 — 30초마다 도는 불러오기는 적지 않습니다.
const ACTIONS=['open','tab'];
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return json({error:'허용되지 않은 요청입니다.'},403);
  const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);
  const body=await req.json().catch(()=>({})) as {action?:unknown;app?:unknown;screen?:unknown};
  const action=typeof body.action==='string'&&ACTIONS.includes(body.action)?body.action:'';
  if(!action)return json({error:'잘못된 요청입니다.'},400);
  const word=(v:unknown)=>typeof v==='string'?v.replace(/[^\w\-:./]/g,'').slice(0,40):'';
  const app=word(body.app),screen=word(body.screen);
  await log(req,{workspace:c.team,actor:c.actor,state:c.state,kind:'app',action,target:[app,screen].filter(Boolean).join(' · ')||undefined,detail:{app,screen}});
  return json({ok:true});
 }catch{return json({ok:false})}
}
