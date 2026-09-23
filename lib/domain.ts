// admin: 직원이면서 관리자 권한을 가진 사람. archived: 삭제한 직원 — 지난 기록을 위해 데이터에는 남기고 화면 목록에서만 감춥니다.
// 흔적까지 지우는 쪽은 employeePurge 입니다 — 그 사람의 근무·출퇴근·급여·작업·메시지가 함께 사라지고 되돌릴 수 없습니다.
export type Employee = {id:string;name:string;color:string;role:string;rate:number;email:string;birthDate:string;phone?:string;punchId?:string;taskManager?:boolean;admin?:boolean;archived?:boolean};
// draft: 새로 넣은 근무는 직원에게 공개하기 전까지 Unpublished 딱지를 답니다. publish 하면 지워집니다.
export type Shift = {id:string;employeeId:string;date:string;start:string;end:string;area:string;note?:string;breakMinutes?:number;originalId?:string;draft?:boolean};
export type Swap = {id:string;shiftId:string;from:string;to:string;status:'requested'|'accepted'|'approved'|'rejected';createdAt:string;bonus:number};
export type Attendance = {id:string;employeeId:string;date:string;start:string;end:string;breakMinutes:number};
export type Message = {id:string;sender:string;to:string;body:string;createdAt:string;readBy:string[];kind:string;recipients?:string[]};
export type Task = {id:string;assignedTo:string;title:string;notes:string;date:string;status:'sent'|'seen'|'completed';createdAt:string;completedAt?:string;createdBy?:string};
export type Decision='pending'|'approved'|'declined';
// Time off covers a date range; a partial day (allDay false) is a single date with start/end times.
export type TimeOff = {id:string;employeeId:string;from:string;to:string;allDay:boolean;start?:string;end?:string;reason:string;status:Decision;createdAt:string;decidedAt?:string};
// Recurring weekly unavailability: weekday 0 (Sun) – 6 (Sat), all day or between start/end.
export type Availability = {id:string;employeeId:string;weekday:number;allDay:boolean;start?:string;end?:string;note:string;effectiveFrom?:string;status:Decision;createdAt:string;decidedAt?:string};
// 직원이 그 자리에서 찍은 실제 출퇴근. 나중에 올리는 출근기계 기록(Attendance)과 달리 지금 이 순간을 말합니다.
export type PunchBreak = {start:string;end?:string;paid:boolean};
// 출퇴근을 찍은 자리. 사진은 서버에 남기지 않고, 어디서 찍었는지만 기록합니다.
// 위치 권한을 막아 둔 기기도 있어 없을 수 있습니다 — 없으면 그냥 비워 둡니다.
export type PunchSpot = {lat:number;lng:number;accuracy?:number};
// 직원이 그 자리에서 찍은 실제 출퇴근. status 는 급여 기간이 닫히기 전 직원 본인이 확인한 결과입니다.
export type Punch = {id:string;employeeId:string;date:string;in:string;out?:string;area?:string;breaks?:PunchBreak[];photoAt?:string;outPhotoAt?:string;spot?:PunchSpot;outSpot?:PunchSpot;status?:'pending'|'approved'|'disputed';disputeNote?:string;editedBy?:string;reviewedAt?:string};
// 출근기계 타임카드는 사람을 이름으로만 알려 줍니다. 한 번 승인한 이름은 이 목록에 남아 다음 임포트부터 자동으로 이어집니다.
export type ClockName = {name:string;raw:string;employeeId:string};
// name 은 비교용으로 다듬은 값, raw 는 출근기계에 찍힌 그대로의 표기입니다.
// 출근기계가 내보내는 이름은 대소문자와 공백이 들쭉날쭉해, 비교할 때도 저장할 때도 이 형태로 맞춥니다.
export const nameKey=(v:string)=>v.toLowerCase().replace(/\s+/g,' ').trim();
// 출퇴근을 찍을 수 있는 자리. 관리자가 현장에서 지정하고, 반경(m) 밖이면 찍히지 않습니다.
export type Workplace = {lat:number;lng:number;radius:number};
// areas: 이 워크스페이스가 직접 늘려 온 업무(직무) 목록. 비어 있으면 아래 기본값을 씁니다.
export type State = {workplace?:Workplace;employees:Employee[];shifts:Shift[];swaps:Swap[];attendance:Attendance[];messages:Message[];tasks:Task[];timeOff?:TimeOff[];availability?:Availability[];punches?:Punch[];clockNames?:ClockName[];areas?:string[];currency:string;published:boolean};
// 클럽이 서 있는 자리의 시간대. 화면·서버·알림이 모두 이 한 줄을 봅니다.
// 온타리오는 뉴욕과 시각이 같아 예전 기록과 어긋나지 않고, 이름만 자리에 맞게 돌아옵니다.
export const TIME_ZONE='America/Toronto';
export const localTime=(d:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
export const localDate=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function weekStart(date:string){return addDays(date,-new Date(date+'T12:00:00Z').getUTCDay())}
export const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
export function duration(start:string,end:string,rest=0){let n=minutes(end)-minutes(start);if(n<0)n+=1440;return Math.max(0,n-rest)/60}
// 휴무·근무 불가 시간·대체 근무는 모두 7일 전에 등록해야 관리자가 스케줄을 다시 짤 여유가 생깁니다. 관리자 본인은 예외입니다.
export const LEAD_DAYS=7;
export const leadDate=(today=localDate(new Date()))=>addDays(today,LEAD_DAYS);
export function canSwap(date:string,today=localDate(new Date())){return date>=leadDate(today)}
export function overlap(a:Shift,b:Shift){const stamp=(s:Shift)=>{const start=Date.parse(s.date+'T00:00:00Z')+minutes(s.start)*60000;return [start,start+duration(s.start,s.end)*3600000]};const [a0,a1]=stamp(a),[b0,b1]=stamp(b);return a0<b1&&b0<a1}
// 두 지점 사이 거리(m). 지구를 공으로 보고 재는 흔한 방법입니다.
export function distanceMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}){
 const rad=(v:number)=>v*Math.PI/180,R=6371000;
 const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
// 클럽이 서 있는 자리. 196 Webber Road, Welland(Pelham), Ontario L3B 5N8, Canada —
// OpenStreetMap 에 등록된 클럽 자체의 좌표입니다. 출퇴근 반경과 날씨가 이 한 줄을 함께 봅니다.
export const CLUB_SPOT={lat:42.98515,lng:-79.30084};
// 기본 반경. 클럽에서 1km 안에서 찍은 것만 통과시키는 선입니다.
// 코스 안쪽과 주차장까지 넉넉히 들어오고, 집이나 옆 동네에서 찍은 것은 들어오지 않습니다.
export const DEFAULT_WORKPLACE_RADIUS=1000;
export const MIN_WORKPLACE_RADIUS=50,MAX_WORKPLACE_RADIUS=2000;
// 아무것도 지정하지 않아도 출퇴근은 클럽 1km 안에서만 찍힙니다.
// 관리자가 자리를 다시 잡으면 그 값을 먼저 보고, 풀면 이 기본값으로 돌아옵니다 — 끄는 길은 없습니다.
export const DEFAULT_WORKPLACE:Workplace={...CLUB_SPOT,radius:DEFAULT_WORKPLACE_RADIUS};
export const workplaceOf=(s:{workplace?:Workplace})=>s.workplace??DEFAULT_WORKPLACE;
export const weekdayOf=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
// 급여 기간은 일요일에 시작하는 2주입니다. 기준일 2026-09-20 은 실제 운영 주기(9/20~10/3)에 맞춘 일요일입니다.
export const PAY_PERIOD_DAYS=14;
export const PAY_ANCHOR='2026-09-20';
const dayNumber=(date:string)=>Math.round(Date.parse(date+'T12:00:00Z')/86400000);
// 기준일보다 앞선 날짜도 같은 주기 위에 떨어지도록 내림으로 맞춥니다.
export function payPeriodStart(date:string){return addDays(PAY_ANCHOR,Math.floor((dayNumber(date)-dayNumber(PAY_ANCHOR))/PAY_PERIOD_DAYS)*PAY_PERIOD_DAYS)}
export const payPeriodEnd=(start:string)=>addDays(start,PAY_PERIOD_DAYS-1);
// 최근 기간부터 과거로 count 개. 화면은 이 목록을 달(시작일 기준)로 묶어 보여 줍니다.
export function payPeriods(today:string,count:number){const first=payPeriodStart(today);return Array.from({length:count},(_,i)=>{const from=addDays(first,-i*PAY_PERIOD_DAYS);return {from,to:payPeriodEnd(from)}})}
// 지금 지나고 있는 기간만 직원이 확인할 수 있습니다. 지난 기간은 급여가 나가 닫힙니다.
export const periodOpen=(from:string,today:string)=>from===payPeriodStart(today);
// 찍힌 출퇴근으로 실제 근무한 시간을 셉니다. 유급 휴게는 근무로 치고 무급 휴게만 뺍니다.
export function punchHours(p:Punch){if(!p.out)return 0;const unpaid=(p.breaks??[]).reduce((sum,b)=>sum+(b.end&&!b.paid?duration(b.start,b.end):0),0);return Math.max(0,duration(p.in,p.out)-unpaid)}
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
// 급여가 보는 근무 기록. 단말에서 찍힌 출퇴근(punches)이 기준입니다.
// 그 사람 그 날짜에 찍힌 기록이 하나도 없을 때만, 예전에 엑셀로 가져온 기록을 씁니다.
// 같은 날을 두 번 세지 않으려는 규칙입니다 — 둘 다 세면 하루치가 두 번 지급됩니다.
// 퇴근까지 찍힌 것만 셉니다. 아직 근무 중인 기록은 끝 시각이 없어 계산할 수 없습니다.
export function paidRecords(state:State):Attendance[]{
 const punched=(state.punches??[]).filter(p=>p.out);
 const punchedDays=new Set(punched.map(p=>p.employeeId+'|'+p.date));
 // 유급 휴게는 일한 시간으로 칩니다. 근무시간에서 빠지는 건 무급 휴게뿐이고, 그것도 끝까지 찍힌 것만입니다.
 const unpaid=(p:Punch)=>(p.breaks??[]).reduce((n,b)=>n+(!b.paid&&b.end?Math.round(duration(b.start,b.end)*60):0),0);
 return [...punched.map(p=>({id:p.id,employeeId:p.employeeId,date:p.date,start:p.in,end:p.out!,breakMinutes:unpaid(p)})),
  ...state.attendance.filter(a=>!punchedDays.has(a.employeeId+'|'+a.date))];
}
// 아직 아무도 보지 않은 기록과, 직원이 틀렸다고 한 기록. 지급 전에 관리자가 알아야 할 숫자라 따로 셉니다.
export function punchReviewCounts(state:State,employeeId:string,from:string,to:string){
 const mine=(state.punches??[]).filter(p=>p.employeeId===employeeId&&p.date>=from&&p.date<=to&&p.out);
 return {unconfirmed:mine.filter(p=>p.status!=='approved'&&p.status!=='disputed').length,
  disputed:mine.filter(p=>p.status==='disputed').length};
}
export function payroll(state:State,employeeId:string,from:string,to:string){const e=state.employees.find(e=>e.id===employeeId)!;const records=paidRecords(state).filter(a=>a.employeeId===employeeId&&a.date>=from&&a.date<=to);const worked=(a:Attendance)=>duration(a.start,a.end,a.breakMinutes);const hours=records.reduce((s,a)=>s+worked(a),0);
 // 날짜별로 합친 뒤 주(일요일 시작)별로 묶어 가산 시간을 구합니다.
 const byDay=new Map<string,number>();for(const a of records)byDay.set(a.date,(byDay.get(a.date)??0)+worked(a));const byWeek=new Map<string,number[]>();for(const [day,h] of byDay){const w=weekStart(day);byWeek.set(w,[...(byWeek.get(w)??[]),h])}
 const otHours=[...byWeek.values()].reduce((s,days)=>{const daily=days.reduce((n,h)=>n+Math.max(0,h-OT_DAILY_HOURS),0);const weekly=Math.max(0,days.reduce((n,h)=>n+h,0)-OT_WEEKLY_HOURS);return s+Math.max(daily,weekly)},0);const regularHours=hours-otHours;
 const lateMinutes=records.reduce((s,a)=>s+(lateBy(state,a)??0),0);const lateDays=new Set(records.filter(a=>(lateBy(state,a)??0)>0).map(a=>a.date)).size;
 const bonus=state.swaps.filter(r=>r.status==='approved'&&r.to===employeeId).reduce((s,r)=>{const shift=state.shifts.find(x=>x.id===r.shiftId);return s+(shift&&shift.date>=from&&shift.date<=to&&records.some(a=>a.date===shift.date&&overlap(shift,{...shift,start:a.start,end:a.end}))?r.bonus:0)},0);
 const base=regularHours*e.rate,otPay=otHours*e.rate*OT_MULTIPLIER,earned=base+otPay+bonus,cents=(n:number)=>Math.round(n*100)/100;
 // 지각 차감은 그 구간에 번 금액까지만. 엑셀 열을 잘못 연결해도 지급액이 마이너스로 내려가지 않습니다.
 const lateDeduction=Math.min(earned,(lateMinutes/60)*e.rate);
 return {hours,regularHours,otHours,lateMinutes,lateDays,base:cents(base),otPay:cents(otPay),bonus,lateDeduction:cents(lateDeduction),total:cents(earned-lateDeduction),...punchReviewCounts(state,employeeId,from,to)}}
// 근무지 이름. 직원 화면과 출퇴근 단말이 같은 이름을 씁니다.
export const LOCATION='Pelham Hills Golf Club';
// 날씨와 일출·일몰은 클럽이 서 있는 자리의 것입니다 — 출퇴근을 찍는 자리와 같은 좌표를 봅니다.
// 관리자가 출퇴근 자리를 다시 잡아 두었으면 그 좌표(state.workplace)를 먼저 쓰고, 없을 때 이 값으로 떨어집니다.
export const WEATHER_SPOT: {lat:number;lng:number} | null = CLUB_SPOT;
// 근무지 장소. 새 직원·새 근무의 기본값이자 시범 데이터의 배정 기준입니다.
export const AREAS=['Proshop','Workshop'] as const;
// 직원의 업무와 근무의 장소는 이제 한 목록입니다 — 작업 지시 권한을 가진 사람이 작업 화면에서 늘립니다.
// 예전에 다른 이름으로 저장된 근무는 그 값을 그대로 유지하고, 그 근무를 열었을 때만 선택지에 함께 보입니다.
export const MAX_AREAS=40;
export function areaList(state:{areas?:string[]}):string[]{return state.areas?.length?state.areas:[...AREAS]}
export function seed():State{const names=['Josh','Grace','Claudio','Francis','James','Karen','Dylan','Dustin','Sam'];const colors=['#5579cf','#c48537','#20a69a','#9864c3','#e17b57','#5c9d61','#d26395','#628597','#a89643'];const employees=names.map((name,i)=>({id:'E'+String(i+1).padStart(3,'0'),name,color:colors[i],role:AREAS[i%AREAS.length],rate:0,email:'',birthDate:'',phone:'',punchId:String(1001+i)}));const week=weekStart(localDate(new Date()));const shifts:Shift[]=[];for(let d=0;d<7;d++) employees.forEach((e,i)=>{if((i+d)%4!==1) shifts.push({id:`s${d}-${i}`,employeeId:e.id,date:addDays(week,d),start:i%3===0?'10:00':i%3===1?'06:00':'12:00',end:i%3===0?'18:00':i%3===1?'14:00':'20:00',area:e.role})});
 // 지난 두 급여 기간과 이번 기간의 출퇴근 기록. 지난 기간은 이미 확인이 끝나 닫혀 있습니다.
 const today=localDate(new Date());const start=addDays(payPeriodStart(today),-2*PAY_PERIOD_DAYS);const punches:Punch[]=[];
 for(let d=0;d<3*PAY_PERIOD_DAYS;d++){const date=addDays(start,d);if(date>today)break;
  employees.forEach((e,i)=>{if((i+d)%4===1)return;const morning=(i+d)%2===0;
   const open=periodOpen(payPeriodStart(date),today);
   punches.push({id:`p${d}-${i}`,employeeId:e.id,date,in:morning?'07:57':'13:59',out:morning?'12:04':'19:35',area:e.role,
    status:open?'pending':'approved',...(open?{}:{reviewedAt:date+'T23:00:00.000Z'}),...(!open&&(i+d)%5===0?{editedBy:'manager'}:{})})})}
 return {employees,shifts,swaps:[],attendance:[],messages:[],tasks:[],timeOff:[],availability:[],punches,clockNames:[],currency:'CAD',published:false}}
