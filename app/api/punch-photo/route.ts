// 출퇴근 때 찍힌 사진 한 장을 돌려줍니다.
// 사진은 workspaces.state 가 아니라 punch_photos 표에 있어, 화면이 필요할 때만 한 장씩 가져옵니다.
// 관리자는 자기 워크스페이스의 사진을 모두, 직원은 자기가 찍은 것만 볼 수 있습니다.
import {env} from '@/lib/db';
import {context,json} from '@/lib/workspace';
export const dynamic='force-dynamic';
const PREFIX='data:image/jpeg;base64,';
// 사진이 없는 것과 볼 권한이 없는 것을 같은 말로 돌려보냅니다. 있고 없고를 훑지 못하도록.
const GONE='사진을 찾을 수 없습니다.';
export async function GET(req:Request){try{
 const c=await context(req);
 if(!c)return json({error:'로그인이 필요합니다.'},401);
 if(!c.row||!c.state)return json({error:'워크스페이스를 먼저 생성하세요.'},400);
 const url=new URL(req.url);
 const punchId=(url.searchParams.get('punch')??'').trim();
 const kind=url.searchParams.get('kind')==='out'?'out':'in';
 if(!punchId)return json({error:GONE},404);
 // 어느 기록의 사진인지 먼저 state 에서 확인합니다. 표를 바로 찌르지 않습니다.
 const punch=(c.state.punches??[]).find(p=>p.id===punchId);
 if(!punch)return json({error:GONE},404);
 if(!c.actor.admin&&punch.employeeId!==c.actor.id)return json({error:GONE},404);
 // workspace 까지 함께 걸러야 합니다. punch_id 만으로는 다른 워크스페이스의 사진에 닿습니다.
 const row=await env.DB.prepare('SELECT photo FROM punch_photos WHERE punch_id = ? AND kind = ? AND workspace = ?')
  .bind(punchId,kind,c.team).first<{photo:string}>();
 if(!row?.photo?.startsWith(PREFIX))return json({error:GONE},404);
 const bytes=Uint8Array.from(atob(row.photo.slice(PREFIX.length)),ch=>ch.charCodeAt(0));
 // 사람 얼굴입니다. 어디에도 남기지 않습니다.
 return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','Content-Disposition':'inline'}});
}catch(e){return json({error:e instanceof Error?e.message:'불러오지 못했습니다.'},403)}}
