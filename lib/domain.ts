export type Employee = {id:string;name:string;color:string;role:string;rate:number;email:string;birthDate:string;phone?:string;taskManager?:boolean};
export type Shift = {id:string;employeeId:string;date:string;start:string;end:string;area:string;originalId?:string};
export type Swap = {id:string;shiftId:string;from:string;to:string;status:'requested'|'accepted'|'approved'|'rejected';createdAt:string;bonus:number};
export type Attendance = {id:string;employeeId:string;date:string;start:string;end:string;breakMinutes:number};
export type Message = {id:string;sender:string;to:string;body:string;createdAt:string;readBy:string[];kind:string;recipients?:string[]};
export type Task = {id:string;assignedTo:string;title:string;notes:string;date:string;status:'sent'|'seen'|'completed';createdAt:string;completedAt?:string;createdBy?:string};
export type Decision='pending'|'approved'|'declined';
// Time off covers a date range; a partial day (allDay false) is a single date with start/end times.
export type TimeOff = {id:string;employeeId:string;from:string;to:string;allDay:boolean;start?:string;end?:string;reason:string;status:Decision;createdAt:string;decidedAt?:string};
// Recurring weekly unavailability: weekday 0 (Sun) – 6 (Sat), all day or between start/end.
export type Availability = {id:string;employeeId:string;weekday:number;allDay:boolean;start?:string;end?:string;note:string;effectiveFrom?:string;status:Decision;createdAt:string;decidedAt?:string};
export type State = {employees:Employee[];shifts:Shift[];swaps:Swap[];attendance:Attendance[];messages:Message[];tasks:Task[];timeOff?:TimeOff[];availability?:Availability[];currency:string;published:boolean};
export const localDate=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function weekStart(date:string){return addDays(date,-new Date(date+'T12:00:00Z').getUTCDay())}
export const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
export function duration(start:string,end:string,rest=0){let n=minutes(end)-minutes(start);if(n<0)n+=1440;return Math.max(0,n-rest)/60}
// 휴무·근무 불가 시간·대체 근무는 모두 7일 전에 등록해야 관리자가 스케줄을 다시 짤 여유가 생깁니다. 관리자 본인은 예외입니다.
export const LEAD_DAYS=7;
export const leadDate=(today=localDate(new Date()))=>addDays(today,LEAD_DAYS);
export function canSwap(date:string,today=localDate(new Date())){return date>=leadDate(today)}
export function overlap(a:Shift,b:Shift){const stamp=(s:Shift)=>{const start=Date.parse(s.date+'T00:00:00Z')+minutes(s.start)*60000;return [start,start+duration(s.start,s.end)*3600000]};const [a0,a1]=stamp(a),[b0,b1]=stamp(b);return a0<b1&&b0<a1}
export const weekdayOf=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
// What an approved time off or unavailability blocks on a shift's date, if anything. Managers are warned, not stopped.
export function blockedBy(state:State,shift:Shift):'timeoff'|'unavailable'|null{const hits=(allDay:boolean,start?:string,end?:string)=>allDay||!start||!end||overlap(shift,{...shift,start,end});if((state.timeOff??[]).some(r=>r.status==='approved'&&r.employeeId===shift.employeeId&&shift.date>=r.from&&shift.date<=r.to&&hits(r.allDay,r.start,r.end)))return 'timeoff';if((state.availability??[]).some(r=>r.status==='approved'&&r.employeeId===shift.employeeId&&r.weekday===weekdayOf(shift.date)&&(!r.effectiveFrom||shift.date>=r.effectiveFrom)&&hits(r.allDay,r.start,r.end)))return 'unavailable';return null}
// 급여 규칙 · 미국 연방(FLSA) 주 40시간 기준에 일 8시간 기준을 함께 적용합니다.
// 한 주 안에서 "일 8시간 초과분의 합"과 "주 40시간 초과분" 중 큰 쪽만 1.5배로 가산해 중복 가산을 막습니다.
export const OT_DAILY_HOURS=8;
export const OT_WEEKLY_HOURS=40;
export const OT_MULTIPLIER=1.5;
// 지각 유예 없음: 예정 출근 시각을 1분이라도 넘기면 지각입니다.
export const LATE_GRACE_MINUTES=0;
// 출근기록의 기준이 되는 예정 근무. 같은 날 겹치는 근무 중 예정 출근 시각이 가장 가까운 것을 봅니다.
export function scheduledFor(state:State,a:Attendance){const worked={...a,area:''};return state.shifts.filter(x=>x.employeeId===a.employeeId&&x.date===a.date&&overlap(x,worked)).sort((x,y)=>Math.abs(minutes(x.start)-minutes(a.start))-Math.abs(minutes(y.start)-minutes(a.start)))[0]}
// 지각 분. 예정 근무가 없으면 기준이 없으므로 null 을 돌려 '정시(0분)'와 구분합니다.
export function lateBy(state:State,a:Attendance){const shift=scheduledFor(state,a);return shift?Math.max(0,minutes(a.start)-minutes(shift.start)-LATE_GRACE_MINUTES):null}
// 조회 구간이 주(일요일 시작) 경계에 맞지 않으면 걸쳐 있는 주의 초과근무가 실제보다 적게 잡힙니다.
export function wholeWeeks(from:string,to:string){return weekStart(from)===from&&weekStart(addDays(to,1))===addDays(to,1)}
// 실근무시간을 정규·초과로 나눠 시급을 곱하고, 승인된 대체 추가수당을 더한 뒤 지각한 만큼 차감합니다.
export function payroll(state:State,employeeId:string,from:string,to:string){const e=state.employees.find(e=>e.id===employeeId)!;const records=state.attendance.filter(a=>a.employeeId===employeeId&&a.date>=from&&a.date<=to);const worked=(a:Attendance)=>duration(a.start,a.end,a.breakMinutes);const hours=records.reduce((s,a)=>s+worked(a),0);
 // 날짜별로 합친 뒤 주(일요일 시작)별로 묶어 가산 시간을 구합니다.
 const byDay=new Map<string,number>();for(const a of records)byDay.set(a.date,(byDay.get(a.date)??0)+worked(a));const byWeek=new Map<string,number[]>();for(const [day,h] of byDay){const w=weekStart(day);byWeek.set(w,[...(byWeek.get(w)??[]),h])}
 const otHours=[...byWeek.values()].reduce((s,days)=>{const daily=days.reduce((n,h)=>n+Math.max(0,h-OT_DAILY_HOURS),0);const weekly=Math.max(0,days.reduce((n,h)=>n+h,0)-OT_WEEKLY_HOURS);return s+Math.max(daily,weekly)},0);const regularHours=hours-otHours;
 const lateMinutes=records.reduce((s,a)=>s+(lateBy(state,a)??0),0);const lateDays=new Set(records.filter(a=>(lateBy(state,a)??0)>0).map(a=>a.date)).size;
 const bonus=state.swaps.filter(r=>r.status==='approved'&&r.to===employeeId).reduce((s,r)=>{const shift=state.shifts.find(x=>x.id===r.shiftId);return s+(shift&&shift.date>=from&&shift.date<=to&&records.some(a=>a.date===shift.date&&overlap(shift,{...shift,start:a.start,end:a.end}))?r.bonus:0)},0);
 const base=regularHours*e.rate,otPay=otHours*e.rate*OT_MULTIPLIER,earned=base+otPay+bonus,cents=(n:number)=>Math.round(n*100)/100;
 // 지각 차감은 그 구간에 번 금액까지만. 엑셀 열을 잘못 연결해도 지급액이 마이너스로 내려가지 않습니다.
 const lateDeduction=Math.min(earned,(lateMinutes/60)*e.rate);
 return {hours,regularHours,otHours,lateMinutes,lateDays,base:cents(base),otPay:cents(otPay),bonus,lateDeduction:cents(lateDeduction),total:cents(earned-lateDeduction)}}
export function seed():State{const names=['Josh','Grace','Claudio','Francis','James','Karen','Dylan','Dustin','Sam'];const colors=['#5579cf','#c48537','#20a69a','#9864c3','#e17b57','#5c9d61','#d26395','#628597','#a89643'];const employees=names.map((name,i)=>({id:'E'+String(i+1).padStart(3,'0'),name,color:colors[i],role:i%3===0?'Outdoor':i%3===1?'Clubhouse':'Snack Bar',rate:0,email:'',birthDate:'',phone:''}));const week=weekStart(localDate(new Date()));const shifts:Shift[]=[];for(let d=0;d<7;d++) employees.forEach((e,i)=>{if((i+d)%4!==1) shifts.push({id:`s${d}-${i}`,employeeId:e.id,date:addDays(week,d),start:i%3===0?'10:00':i%3===1?'06:00':'12:00',end:i%3===0?'18:00':i%3===1?'14:00':'20:00',area:e.role})});return {employees,shifts,swaps:[],attendance:[],messages:[],tasks:[],timeOff:[],availability:[],currency:'USD',published:false}}
