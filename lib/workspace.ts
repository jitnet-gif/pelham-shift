import type {State} from '@/lib/domain';
import type {Actor} from '@/lib/operations';
import {getBirthSession} from '@/lib/birth-auth';
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const sameOrigin=(req:Request)=>{const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin};
// Only the birth-date session authenticates: ChatGPT identity headers are injected by Sites hosting and can be forged anywhere else.
export async function context(req:Request){const local=await getBirthSession(req);if(!local)return null;const user={userId:local.actor.admin?'master':local.actor.id,displayName:local.actor.admin?'대표님':'직원',email:'',fullName:null};return {user,team:local.team,row:local.row,state:local.state,actor:local.actor,authMethod:'birth',passwordChanged:local.passwordChanged}}
export function visible(state:State,actor:Actor){const tasks=state.tasks??[];if(actor.admin)return {...state,tasks};return {...state,tasks:[],employees:state.employees.map(e=>e.id===actor.id?{...e,email:'',birthDate:'',phone:''}:{...e,email:'',birthDate:'',phone:'',rate:0}),shifts:state.published?state.shifts:[],attendance:state.attendance.filter(a=>a.employeeId===actor.id),swaps:[],messages:[]}}
