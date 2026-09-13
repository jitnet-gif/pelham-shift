import {env} from 'cloudflare:workers';
import type {State} from '@/lib/domain';
import {json} from '@/lib/workspace';
import {remind} from '@/lib/push';
export const dynamic='force-dynamic';
// Called by an external cron (every ~5 min) so shift reminders go out even when nobody has the app open.
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
export async function GET(req:Request){try{const url=new URL(req.url);const team=url.searchParams.get('team')||'';const key=await env.DB.prepare('SELECT tick_key AS tickKey FROM push_keys WHERE workspace = ?').bind(team).first<{tickKey:string}>();if(!key||!same(key.tickKey,url.searchParams.get('key')||''))return json({error:'허용되지 않은 요청입니다.'},403);const row=await env.DB.prepare('SELECT state FROM workspaces WHERE id = ?').bind(team).first<{state:string}>();if(!row)return json({error:'워크스페이스가 없습니다.'},404);return json({ok:true,sent:await remind(team,JSON.parse(row.state) as State,url.origin)})}catch(e){return json({error:e instanceof Error?e.message:'점검하지 못했습니다.'},500)}}
