import {livePunches,localDate,publicShifts,type Shift,type State} from '@/lib/domain';
import type {Actor} from '@/lib/operations';
import {getBirthSession} from '@/lib/birth-auth';
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const sameOrigin=(req:Request)=>{const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin};
// Only the birth-date session authenticates: ChatGPT identity headers are injected by Sites hosting and can be forged anywhere else.
export async function context(req:Request){const local=await getBirthSession(req);if(!local)return null;const user={userId:local.actor.admin?'master':local.actor.id,displayName:local.actor.admin?'Owner':'Staff',email:'',fullName:null};return {user,team:local.team,row:local.row,state:local.state,actor:local.actor,authMethod:'birth',passwordChanged:local.passwordChanged}}
// 지운 작업·메시지는 데이터에 남아 있어도 누구의 화면에도 보내지 않습니다 — 엑셀 백업과 활동 로그에만 남습니다.
// 삭제(보관)한 직원의 오늘 이후 근무와 그 사람에게 간 작업도 감춥니다. 지난 근무는 급여(지각·조퇴) 계산이 기대므로 그대로 둡니다.
function hideRemoved(state:State):State{const gone=new Set(state.employees.filter(e=>e.archived).map(e=>e.id)),today=localDate(new Date());const shown=(x:Shift)=>!(gone.has(x.employeeId)&&x.date>=today);
 return {...state,shifts:state.shifts.filter(shown),...(state.publishedShifts?{publishedShifts:state.publishedShifts.filter(shown)}:{}),tasks:(state.tasks??[]).filter(t=>!t.removedAt&&!gone.has(t.assignedTo)),messages:state.messages.filter(m=>!m.removedAt),punches:livePunches(state)}}
export function visible(full:State,actor:Actor){const state=hideRemoved(full);const tasks=state.tasks??[],timeOff=state.timeOff??[],availability=state.availability??[],punches=state.punches??[],clockNames=state.clockNames??[];if(actor.admin)return {...state,publishedShifts:publicShifts(state),tasks,timeOff,availability,punches,clockNames};const me=state.employees.find(e=>e.id===actor.id),taskManager=!!me?.taskManager;
// 출퇴근 수정 권한은 모든 직원의 출퇴근을 봐야 고칠 수 있습니다. 남의 기록에서 찍은 자리(GPS)는 빼고 보냅니다.
const punchManager=!!me?.punchManager;
return {...state,clockNames:[],payHours:[],punches:punchManager?punches.map(r=>r.employeeId===actor.id?r:{...r,spot:undefined,outSpot:undefined}):punches.filter(r=>r.employeeId===actor.id),timeOff:timeOff.filter(r=>r.employeeId===actor.id),availability:availability.filter(r=>r.employeeId===actor.id),tasks:taskManager?tasks:tasks.filter(t=>t.assignedTo===actor.id),employees:state.employees.map(e=>e.id===actor.id?{...e,email:'',birthDate:'',phone:''}:{...e,email:'',birthDate:'',phone:'',punchId:undefined,rate:0,salary:undefined,startRate:undefined}),// 근무를 편성하는 사람은 작업본과 진행 중인 대체근무까지 봐야 합니다 — 그러지 않으면 고칠 것이 화면에 없습니다.
// 나머지 직원은 마지막으로 공개한 근무표(공개본)를 봅니다. 공개 뒤에 고친 근무는 다음 공개 때까지 고치기 전 모습으로 보입니다.
shifts:taskManager?state.shifts:publicShifts(state),publishedShifts:taskManager?publicShifts(state):undefined,attendance:punchManager?state.attendance:state.attendance.filter(a=>a.employeeId===actor.id),swaps:taskManager?state.swaps:[],
// Staff see what was sent to them (directly, to everyone, or to a notice list they are on) and what they sent; other staff's read receipts stay private.
messages:state.messages.filter(m=>m.sender===actor.id||m.to===actor.id||(m.to==='all'&&(!m.recipients||m.recipients.includes(actor.id)))).map(m=>({...m,recipients:undefined,readBy:m.readBy.filter(id=>id===actor.id||id==='admin')}))}}
