import {env} from '@/lib/db';
import {localDate} from '@/lib/domain';
import {context,json,sameOrigin} from '@/lib/workspace';
import {log,readLogs,writeLog} from '@/lib/audit';
import {BACKUP_LOG_ROWS,buildBackup,readBackup} from '@/lib/backup';
export const dynamic='force-dynamic';

// 엑셀 전체 백업. 화면에서 감춘 것(삭제한 직원·작업·메시지)까지 워크스페이스에 있는 모든 기록과 최근 활동 로그를 담습니다.
export async function GET(req:Request){
 try{
  const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);
  if(!c.actor.admin)return json({error:'관리자 권한이 필요합니다.'},403);
  if(!c.row||!c.state)return json({error:'워크스페이스를 먼저 생성하세요.'},400);
  const logs=await readLogs(c.team,BACKUP_LOG_ROWS).catch(()=>[]);
  const file=await buildBackup(c.state,{workspace:c.team,version:c.row.version},logs);
  await log(req,{workspace:c.team,actor:c.actor,state:c.state,kind:'backup',action:'backupDownload',detail:{version:c.row.version,logRows:logs.length,bytes:file.length}});
  const name=`PelhamShift_backup_${localDate(new Date())}.xlsx`;
  return new Response(new Uint8Array(file),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'}});
 }catch(e){return json({error:e instanceof Error?e.message:'백업 파일을 만들지 못했습니다.'},500)}
}

// 엑셀 복구. 올린 백업 파일로 워크스페이스 전체를 바꿉니다.
// 바꾸기 직전의 워크스페이스 전체를 활동 로그에 먼저 남기고, 그게 실패하면 복구하지 않습니다 — 잘못 올린 파일로 기록을 잃지 않게.
// 활동 로그 표는 복구 대상이 아닙니다.
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return json({error:'허용되지 않은 요청입니다.'},403);
  const c=await context(req);if(!c)return json({error:'로그인이 필요합니다.'},401);
  if(!c.actor.admin)return json({error:'관리자 권한이 필요합니다.'},403);
  if(!c.row||!c.state)return json({error:'워크스페이스를 먼저 생성하세요.'},400);
  const form=await req.formData();const file=form.get('file');
  if(!(file instanceof File)||!file.size)return json({error:'백업 파일을 고르세요.'},400);
  if(file.size>4000000)return json({error:'파일이 너무 큽니다.'},413);
  const {state,workspace,exportedAt}=await readBackup(await file.arrayBuffer());
  if(workspace&&workspace!==c.team)return json({error:'다른 워크스페이스의 백업 파일입니다.'},400);
  const text=JSON.stringify(state);
  if(text.length>5000000)return json({error:'복구할 데이터가 너무 큽니다.'},413);
  await writeLog(req,{workspace:c.team,actor:c.actor,state:c.state,kind:'backup',action:'restoreBefore',target:file.name.slice(0,200),detail:{version:c.row.version,state:c.state}});
  const result=await env.DB.prepare('UPDATE workspaces SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(text,c.team,c.row.version).run();
  if(result.meta.changes!==1)return json({error:'동시 변경이 감지되었습니다. 다시 시도하세요.'},409);
  await log(req,{workspace:c.team,actor:c.actor,state,kind:'backup',action:'restore',target:file.name.slice(0,200),detail:{fromVersion:c.row.version,exportedAt,counts:Object.fromEntries(Object.entries(state).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).length]))}});
  return json({ok:true,version:c.row.version+1});
 }catch(e){return json({error:e instanceof Error?e.message:'복구하지 못했습니다.'},400)}
}
