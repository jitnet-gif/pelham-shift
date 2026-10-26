import {env} from '@/lib/db';
import {addDays,holidayOn,paidRecords,payableHours,payroll,PAY_PERIOD_DAYS,type State} from '@/lib/domain';
export const dynamic='force-dynamic';

// 인건비 합계 — 클럽 시스템(pelhamhills 의 AI 마케팅, Fly 서버)이 손익분기점을 따질 때 부릅니다.
// 사람 이름·시급·연락처는 내보내지 않습니다. 기간의 합계와 날짜·직무·주중/주말별 합만 돌려줍니다.
//
// 서버끼리만 씁니다: 요청 머리 `x-labor-key` 가 환경변수 LABOR_API_KEY 와 같아야 합니다(없으면 503).
// 팀은 ?team= 이나 LABOR_TEAM, 둘 다 없으면 워크스페이스가 하나일 때 그 팀입니다.
//
// 돈은 급여 화면(Work hours)과 같은 규칙입니다:
//  - 시급 직원: payroll() 의 예상 급여(초과·공휴일 가산 포함). 관리자가 그 기간에 손으로 적은 시간·금액(payHours)이 있으면 그 값.
//  - 관리직(2주 급여가 적힌 사람)과 대표(ownerSalary, 기본 2500): 2주 급여를 날짜 수로 나눠 기간만큼(그 기간의 Revised 금액이 있으면 그 값).
//  - 'admin & operation' 직무는 시급 표에 세우지 않습니다(급여 화면과 같음 — 관리 쪽 급여로 갑니다).
// 날짜·직무별 합은 근무 시간 × 시급이라 초과·공휴일 가산분은 들어 있지 않습니다 — 합계(total)에만 있습니다.

const OWNER_SALARY=2500;
const OFF_SHEET=['admin & operation'];
const r2=(n:number)=>Math.round(n*100)/100;
const DATE=/^\d{4}-\d{2}-\d{2}$/;

export async function GET(req:Request){
 const key=process.env.LABOR_API_KEY||'';
 if(!key)return Response.json({error:'LABOR_API_KEY is not set.'},{status:503});
 if(req.headers.get('x-labor-key')!==key)return Response.json({error:'Not allowed.'},{status:403});
 const url=new URL(req.url);
 const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
 if(!DATE.test(from)||!DATE.test(to)||to<from)return Response.json({error:'Pick from and to as YYYY-MM-DD.'},{status:400});
 const team=url.searchParams.get('team')||process.env.LABOR_TEAM||'';
 const rows=team
  ?(await env.DB.prepare('SELECT id, state FROM workspaces WHERE id = ?').bind(team).all<{id:string;state:string}>()).results
  :(await env.DB.prepare('SELECT id, state FROM workspaces LIMIT 5').all<{id:string;state:string}>()).results;
 if(!rows.length)return Response.json({error:'No workspace.'},{status:404});
 if(rows.length>1)return Response.json({error:'More than one team. Set LABOR_TEAM or pass ?team=.'},{status:409});
 const state=JSON.parse(rows[0].state) as State;

 const days=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
 const hourlyStaff=state.employees.filter(e=>!e.salary&&!OFF_SHEET.includes((e.role||'').trim().toLowerCase()));
 const records=paidRecords(state).filter(a=>a.date>=from&&a.date<=to);
 const rateOf=new Map(state.employees.map(e=>[e.id,e.rate]));
 const hourlyIds=new Set(hourlyStaff.map(e=>e.id));
 const areaOf=new Map((state.punches??[]).map(p=>[p.id,p.area||'']));
 const roleOf=new Map(state.employees.map(e=>[e.id,e.role||'']));

 let hours=0,regular=0,ot=0,holiday=0,pay=0,staff=0;
 for(const e of hourlyStaff){
  const p=payroll(state,e.id,from,to);
  const hand=(state.payHours??[]).find(x=>x.employeeId===e.id&&x.from===from&&x.to===to);
  const h=hand?hand.hours:p.hours,w=hand?(hand.wage??hand.hours*e.rate):p.total;
  if(!(h>0||w>0))continue;
  staff++;hours+=h;pay+=w;
  if(!hand){regular+=p.regularHours;ot+=p.otHours;holiday+=p.holidayHours}else regular+=h;
 }

 const byDay=new Map<string,{hours:number;pay:number;staff:Set<string>}>();
 const byArea=new Map<string,{hours:number;pay:number}>();
 for(const a of records){
  if(!hourlyIds.has(a.employeeId))continue;
  const h=payableHours(state,a),w=h*(rateOf.get(a.employeeId)??0);
  const d=byDay.get(a.date)??{hours:0,pay:0,staff:new Set<string>()};d.hours+=h;d.pay+=w;d.staff.add(a.employeeId);byDay.set(a.date,d);
  const area=(areaOf.get(a.id)||roleOf.get(a.employeeId)||'Other').trim()||'Other';
  const x=byArea.get(area)??{hours:0,pay:0};x.hours+=h;x.pay+=w;byArea.set(area,x);
 }
 const weekend=(d:string)=>{const w=new Date(d+'T12:00:00Z').getUTCDay();return w===0||w===6||!!holidayOn(d)};
 const byDaytype={weekday:{days:0,hours:0,pay:0},weekend:{days:0,hours:0,pay:0}};
 for(let d=from;d<=to;d=addDays(d,1))byDaytype[weekend(d)?'weekend':'weekday'].days++;
 for(const [d,v] of byDay){const t=byDaytype[weekend(d)?'weekend':'weekday'];t.hours+=v.hours;t.pay+=v.pay}

 const revised=(id:string)=>(state.managerPay??[]).find(x=>x.managerId===id&&x.from===from&&x.to===to)?.amount;
 const managers=[{id:'owner',salary:state.ownerSalary??OWNER_SALARY},...state.employees.filter(e=>e.salary&&!e.archived).map(e=>({id:e.id,salary:e.salary??0}))];
 const biweekly=managers.reduce((n,m)=>n+m.salary,0);
 const management=managers.reduce((n,m)=>n+(revised(m.id)??m.salary*days/PAY_PERIOD_DAYS),0);

 return Response.json({
  period:{from,to,days},currency:state.currency||'CAD',
  hourly:{staff,hours:r2(hours),regular_hours:r2(regular),ot_hours:r2(ot),holiday_hours:r2(holiday),pay:r2(pay)},
  management:{people:managers.length,biweekly_total:r2(biweekly),pay:r2(management)},
  total_labor:r2(pay+management),
  by_daytype:{weekday:{...byDaytype.weekday,hours:r2(byDaytype.weekday.hours),pay:r2(byDaytype.weekday.pay)},weekend:{...byDaytype.weekend,hours:r2(byDaytype.weekend.hours),pay:r2(byDaytype.weekend.pay)}},
  by_area:[...byArea].map(([area,v])=>({area,hours:r2(v.hours),pay:r2(v.pay)})).sort((a,b)=>b.pay-a.pay),
  by_day:[...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,hours:r2(v.hours),pay:r2(v.pay),staff:v.staff.size})),
 },{headers:{'Cache-Control':'no-store'}});
}
