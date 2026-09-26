import {context,json} from '@/lib/workspace';
import {log,readLogs} from '@/lib/audit';
import {buildLogBook} from '@/lib/backup';
export const dynamic='force-dynamic';

// 활동 로그를 기간을 골라 엑셀로 받습니다. 백업 파일에는 최근 로그만 실리므로, 오래된 로그는 여기서 받습니다.
// 응답 한 번의 크기 한도(Vercel 4.5MB) 안에 들도록 줄 수를 막습니다. 넘치면 기간을 좁혀 여러 번 받습니다.
const MAX_ROWS=50000;
export async function GET(req:Request){
 try{
  const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);
  if(!c.actor.admin)return json({error:'관리자 권한이 필요합니다.'},403);
  const url=new URL(req.url),day=/^\d{4}-\d{2}-\d{2}$/;
  const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
  if((from&&!day.test(from))||(to&&!day.test(to)))return json({error:'날짜를 확인하세요.'},400);
  const logs=await readLogs(c.team,MAX_ROWS,from,to);
  await log(req,{workspace:c.team,actor:c.actor,state:c.state,kind:'backup',action:'logDownload',detail:{from,to,rows:logs.length}});
  const file=await buildLogBook(logs);
  const name=`PelhamShift_log_${from||'all'}_${to||'now'}.xlsx`;
  return new Response(new Uint8Array(file),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'}});
 }catch(e){return json({error:e instanceof Error?e.message:'로그를 내려받지 못했습니다.'},500)}
}
