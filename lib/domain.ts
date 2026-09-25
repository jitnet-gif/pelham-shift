// admin: 직원이면서 관리자 권한을 가진 사람. archived: 삭제한 직원 — 지난 기록을 위해 데이터에는 남기고 화면 목록에서만 감춥니다.
// 흔적까지 지우는 쪽은 employeePurge 입니다 — 그 사람의 근무·출퇴근·급여·작업·메시지가 함께 사라지고 되돌릴 수 없습니다.
// roles: 그 사람이 맡은 직군 전부. Proshop 과 Workshop 을 함께 맡는 멀티 플레이어를 위해 둡니다.
// role: 그중 첫째 직군. 근무와 출퇴근은 장소를 하나만 적기에, 비워 둔 자리를 이 값으로 채웁니다.
// overtimeManager: 한 주 44시간을 넘는 근무를 짤 수 있는 사람. 근무 편성 권한과 따로 둡니다 —
// 근무표를 짜는 것과 초과근무 수당이 붙는 근무를 내는 것은 다른 결정이기 때문입니다.
export type Employee = {id:string;name:string;color:string;role:string;roles?:string[];rate:number;email:string;birthDate:string;phone?:string;punchId?:string;taskManager?:boolean;overtimeManager?:boolean;admin?:boolean;archived?:boolean};
// draft: 새로 넣거나 고친 근무는 직원에게 공개하기 전까지 Unpublished 딱지를 답니다. publish 하면 지워집니다.
export type Shift = {id:string;employeeId:string;date:string;start:string;end:string;area:string;note?:string;breakMinutes?:number;originalId?:string;draft?:boolean};
export type Swap = {id:string;shiftId:string;from:string;to:string;status:'requested'|'accepted'|'approved'|'rejected';createdAt:string;bonus?:number};
export type Attendance = {id:string;employeeId:string;date:string;start:string;end:string;breakMinutes:number};
export type Message = {id:string;sender:string;to:string;body:string;createdAt:string;readBy:string[];kind:string;recipients?:string[]};
// time 은 마감 시각입니다. 적지 않고 보낼 수 있어 예전에 보낸 작업에는 없습니다.
export type Task = {id:string;assignedTo:string;title:string;notes:string;date:string;time?:string;status:'sent'|'seen'|'completed';createdAt:string;completedAt?:string;createdBy?:string};
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
// shifts 는 편성하는 사람이 고치는 작업본, publishedShifts 는 마지막으로 공개한 순간의 근무표(공개본)입니다.
// 직원은 언제나 공개본만 봅니다 — 작업본을 아무리 고쳐도 직원 화면이 비는 일이 없습니다.
// published 는 '작업본이 공개본과 같다'는 뜻으로, 저장할 때마다 두 근무표를 견주어 다시 적습니다.
export type State = {workplace?:Workplace;employees:Employee[];shifts:Shift[];swaps:Swap[];attendance:Attendance[];messages:Message[];tasks:Task[];timeOff?:TimeOff[];availability?:Availability[];punches?:Punch[];clockNames?:ClockName[];areas?:string[];currency:string;published:boolean;publishedShifts?:Shift[]};
// 클럽이 서 있는 자리의 시간대. 화면·서버·알림이 모두 이 한 줄을 봅니다.
// 온타리오는 뉴욕과 시각이 같아 예전 기록과 어긋나지 않고, 이름만 자리에 맞게 돌아옵니다.
export const TIME_ZONE='America/Toronto';
export const localTime=(d:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
export const localDate=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function weekStart(date:string){return addDays(date,-new Date(date+'T12:00:00Z').getUTCDay())}
// 스케줄 화면은 관리자·직원 모두 일요일부터 다음 주 토요일까지 두 주를 한 번에 보여 줍니다.
export const SCHEDULE_DAYS=14;
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
// 퇴근을 찍지 않은 채 날이 바뀐 기록. 출근은 새 날짜로 다시 찍히고, 이 기록은 '근무 중'이 아니라 '퇴근 미기록'으로 보입니다.
// 끝 시각이 없어 급여에는 들어가지 않습니다 — 없는 퇴근 시각을 지어내면 그대로 지급액이 됩니다.
export const missingOut=(p:Punch,today:string)=>!p.out&&p.date<today;
// 찍힌 출퇴근으로 실제 근무한 시간을 셉니다. 유급 휴게는 근무로 치고 무급 휴게만 뺍니다.
export function punchHours(p:Punch){if(!p.out)return 0;const unpaid=(p.breaks??[]).reduce((sum,b)=>sum+(b.end&&!b.paid?duration(b.start,b.end):0),0);return Math.max(0,duration(p.in,p.out)-unpaid)}
// 그 근무에 출근을 찍었는지. 펀치에는 근무 번호가 없어, 찍은 시각에 가장 가까운 근무의 것으로 봅니다 —
// 출근을 찍을 때 장소를 어느 근무에서 가져올지 정하는 규칙과 같습니다(operations.ts 의 punchIn).
// 그래서 오전 근무에 찍은 출근이 같은 날 오후 근무의 알림까지 함께 걷어 가지 않습니다.
// 퇴근까지 찍은 기록도 '찍었다'로 셉니다 — 이미 다녀온 근무를 두고 출근을 채근할 일은 없습니다.
export function punchedIn(state:State,shift:Shift){
 const sameDay=state.shifts.filter(x=>x.employeeId===shift.employeeId&&x.date===shift.date);
 const nearest=(p:Punch)=>[...sameDay].sort((x,y)=>Math.abs(minutes(x.start)-minutes(p.in))-Math.abs(minutes(y.start)-minutes(p.in)))[0];
 // 근무표에 없는 근무로 물어 오면 기댈 기준이 없습니다. 그 날 찍힌 출근이 있으면 찍은 것으로 봅니다.
 return (state.punches??[]).some(p=>p.employeeId===shift.employeeId&&p.date===shift.date&&(nearest(p)?.id??shift.id)===shift.id);
}
// 클럽 시각으로 본 지금의 분. 근무 시작까지 남은 시간을 셀 때 기준이 됩니다.
export const clubMinutes=(now:Date)=>minutes(new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now));
// 알림 창의 폭(분). 시작 60분 전부터 알리고, 시작하고도 60분 동안은 출근이 찍혔는지 지켜봅니다.
// 넓게 잡은 이유: 바깥 cron 이 20분쯤 늦게 도착해도 창 안에 들어와야 하고, 보낸 기록이 두 번 보내는 것을 막아 줍니다.
export const REMIND_WINDOW=60;
// 지금부터 근무 시작까지 남은 분. 어제·오늘·내일에 걸친 근무를 함께 보므로 날짜 차이를 같이 셉니다.
const untilStart=(s:Shift,today:string,current:number)=>(s.date===today?0:s.date>today?1440:-1440)+minutes(s.start)-current;
// 공개본. 공개본을 따로 두기 전의 워크스페이스에는 없으므로, 그때 직원이 보던 것으로 채웁니다 —
// 공개 중이었으면 근무표 전체, 작성 중이었으면 Unpublished 딱지가 없는 근무(한 번이라도 공개된 모습 그대로인 근무)입니다.
export const publicShifts=(state:State):Shift[]=>state.publishedShifts??(state.published?state.shifts:state.shifts.filter(x=>!x.draft));
// 공개를 기다리는 변경 수. 새로 넣거나 고친 근무, 그리고 공개본에는 있는데 작업본에서 지운 근무를 셉니다.
// draft 딱지는 견주지 않습니다 — 딱지만 다르고 내용이 같으면 직원이 보는 것도 같습니다.
// 빈 칸(undefined)은 저장하면 사라지므로 없는 칸과 같게 봅니다.
const shiftKey=({draft:_,...x}:Shift)=>JSON.stringify(Object.entries(x).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)));
export function pendingChanges(state:State){const shown=new Map(publicShifts(state).map(x=>[x.id,shiftKey(x)]));let n=0;for(const x of state.shifts){if(shown.get(x.id)!==shiftKey(x))n++;shown.delete(x.id)}return n+shown.size}
// 저장할 때마다 부릅니다. 고쳤다가 공개본과 똑같이 되돌린 근무는 Unpublished 딱지를 떼고,
// '공개 중'은 작업본과 공개본이 같을 때로 다시 적습니다. 명령마다 스위치를 따로 켜고 끄지 않습니다.
export function settlePublished(state:State){const shown=new Map(publicShifts(state).map(x=>[x.id,shiftKey(x)]));for(const x of state.shifts)if(x.draft&&shown.get(x.id)===shiftKey(x))delete x.draft;state.published=pendingChanges(state)===0}
// 알림이 걸릴 만한 근무만 걸러 냅니다. 직원이 보는 공개본을 봅니다 — 공개하지 않은 변경은 직원에게 아직 없는 일정이라 알리지 않습니다.
function nearShifts(state:State,now:Date,keep:(left:number)=>boolean){const today=localDate(now),current=clubMinutes(now);const days=new Set([addDays(today,-1),today,addDays(today,1)]);return publicShifts(state).filter(s=>days.has(s.date)&&keep(untilStart(s,today,current)))}
// 곧 시작하는 근무. 이미 출근을 찍은 사람에게는 알릴 것이 없어 빠집니다.
export const dueShifts=(state:State,now=new Date())=>nearShifts(state,now,left=>left>0&&left<=REMIND_WINDOW).filter(s=>!punchedIn(state,s));
// 출근을 깜빡한 근무. 시작 시각을 지났는데도 출근이 찍히지 않은 사이입니다.
export const missedShifts=(state:State,now=new Date())=>nearShifts(state,now,left=>left<=0&&left>=-REMIND_WINDOW).filter(s=>!punchedIn(state,s));
// What an approved time off or unavailability blocks on a shift's date, if anything. Managers are warned, not stopped.
export function blockedBy(state:State,shift:Shift):'timeoff'|'unavailable'|null{const hits=(allDay:boolean,start?:string,end?:string)=>allDay||!start||!end||overlap(shift,{...shift,start,end});if((state.timeOff??[]).some(r=>r.status==='approved'&&r.employeeId===shift.employeeId&&shift.date>=r.from&&shift.date<=r.to&&hits(r.allDay,r.start,r.end)))return 'timeoff';if((state.availability??[]).some(r=>r.status==='approved'&&r.employeeId===shift.employeeId&&r.weekday===weekdayOf(shift.date)&&(!r.effectiveFrom||shift.date>=r.effectiveFrom)&&hits(r.allDay,r.start,r.end)))return 'unavailable';return null}
// 급여 규칙 · 온타리오 고용기준법(ESA)을 따라 한 주(일요일 시작) 44시간을 넘긴 시간만 1.5배로 가산합니다.
// 하루 기준은 없습니다 — 하루 10시간을 일해도 그 주 합이 44시간 안이면 가산하지 않습니다.
export const OT_WEEKLY_HOURS=44;
export const OT_MULTIPLIER=1.5;
// 짜 놓은 근무표가 이 선을 얼마나 넘었는지 자리마다 셉니다. 급여가 초과근무를 세는 눈금과 같은 선을 봅니다 —
// 편성에서 다른 선을 쓰면 통과한 근무가 급여에서 가산되거나 그 반대가 됩니다.
// 무급 휴게는 빼고 셉니다. dates 에 적은 날이 속한 주만 보므로, 손대지 않은 주는 건드리지 않습니다.
// 키는 'w:그 주의 일요일'. 편성 전후를 같은 키로 견주어, 이미 넘어 있던 근무는 그대로 두고
// 이번 편성이 더 넘긴 자리만 가려냅니다.
export function overtimeOver(shifts:Shift[],employeeId:string,dates:string[]):Map<string,number>{
 const mine=shifts.filter(x=>x.employeeId===employeeId);
 const hours=(list:Shift[])=>list.reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes??0),0);
 const over=new Map<string,number>();
 for(const week of [...new Set(dates.map(d=>weekStart(d)))].sort()){
  const end=addDays(week,7);
  const total=hours(mine.filter(x=>x.date>=week&&x.date<end))-OT_WEEKLY_HOURS;
  if(total>0)over.set('w:'+week,total);
 }
 return over;
}
// 이번 주(일요일 시작) 실제로 일한 시간이 44시간을 넘은 사람. 관리자에게 알리는 데 씁니다.
// 급여와 같은 눈금(paidRecords·payableHours)으로 재고, 아직 퇴근을 찍지 않은 근무는 지금까지를 더합니다 —
// 근무 중에 선을 넘는 순간 알 수 있게 하려는 것입니다. 퇴근을 잊고 며칠 열려 있는 기록은 어제·오늘 것만 셉니다.
export function overtimeWorked(state:State,now=new Date()){
 const today=localDate(now),week=weekStart(today),current=localTime(now);
 const open=(state.punches??[]).filter(p=>!p.out&&p.date>=week&&p.date>=addDays(today,-1)).map(p=>({id:p.id,employeeId:p.employeeId,date:p.date,start:p.in,end:current,breakMinutes:(p.breaks??[]).reduce((n,b)=>n+(!b.paid&&b.end?Math.round(duration(b.start,b.end)*60):0),0)}));
 const worked=new Map<string,number>();
 for(const a of [...paidRecords(state).filter(a=>a.date>=week&&a.date<=today),...open])worked.set(a.employeeId,(worked.get(a.employeeId)??0)+payableHours(state,a));
 return state.employees.filter(e=>!e.archived&&(worked.get(e.id)??0)>OT_WEEKLY_HOURS).map(e=>({employee:e,week,hours:worked.get(e.id)!}));
}
// 근무표를 고치기 전(before)과 뒤(after)를 견주어, 주 44시간을 새로 넘기거나 더 넘긴 자리를 사람·주마다 돌려줍니다.
// 편성 권한 검사(overtimeOver)와 같은 선을 봅니다. 줄어든 자리나 그대로인 자리는 빠집니다.
export function overtimeAdded(before:Shift[],after:Shift[]){
 const out:{employeeId:string;week:string;hours:number}[]=[];
 for(const employeeId of new Set(after.map(x=>x.employeeId))){
  const dates=after.filter(x=>x.employeeId===employeeId).map(x=>x.date);
  const was=overtimeOver(before,employeeId,dates);
  for(const [key,over] of overtimeOver(after,employeeId,dates))
   if(over>(was.get(key)??0)+0.001)out.push({employeeId,week:key.slice(2),hours:OT_WEEKLY_HOURS+over});
 }
 return out;
}
// 지각 유예 없음: 예정 출근 시각을 1분이라도 넘기면 지각입니다.
export const LATE_GRACE_MINUTES=0;
// 출근기록의 기준이 되는 예정 근무. 같은 날 겹치는 근무 중 예정 출근 시각이 가장 가까운 것을 봅니다.
export function scheduledFor(state:State,a:Attendance){const worked={...a,area:''};return state.shifts.filter(x=>x.employeeId===a.employeeId&&x.date===a.date&&overlap(x,worked)).sort((x,y)=>Math.abs(minutes(x.start)-minutes(a.start))-Math.abs(minutes(y.start)-minutes(a.start)))[0]}
// 지각 분. 예정 근무가 없으면 기준이 없으므로 null 을 돌려 '정시(0분)'와 구분합니다.
export function lateBy(state:State,a:Attendance){const shift=scheduledFor(state,a);return shift?Math.max(0,minutes(a.start)-minutes(shift.start)-LATE_GRACE_MINUTES):null}
// 조퇴 유예 없음: 예정 퇴근 시각보다 1분이라도 일찍 찍으면 조퇴입니다.
export const EARLY_GRACE_MINUTES=0;
// 예정 퇴근 시각까지 몇 분 남았는지. 예정 근무가 없으면 기준이 없으므로 null 을 돌려 '정시(0분)'와 구분합니다 —
// 일정 없이 찍은 사람은 조퇴로 보지 않습니다.
// 재는 자리는 찍힌 출근입니다. 시계 글자(HH:MM)만으로 지금과 종료 시각을 견주면
// 22:00-02:00 근무는 밤새 조퇴로 보입니다. 출근에서부터 재면 자정을 넘기는 근무도 한 번에 맞습니다.
export function earlyOut(shift:Shift|undefined,inAt:string,outAt:string){
 if(!shift)return null;
 // 하루 안에 끝나는 근무인데 예정 종료를 지나서 찍은 출근입니다. 남은 시간이 자정을 돌아
 // 24시간 가까이 나오므로 기준이 되지 못합니다 - 한참 늦게 온 사람을 조퇴로 만들지 않습니다.
 if(minutes(shift.end)>minutes(shift.start)&&minutes(inAt)>minutes(shift.end))return null;
 const planned=duration(inAt,shift.end);
 return planned>0?Math.max(0,Math.round((planned-duration(inAt,outAt))*60)-EARLY_GRACE_MINUTES):null;
}
// 조퇴 분. 지각과 같은 예정 근무(scheduledFor)를 기준으로 삼습니다 —
// 한 기록을 두 눈금이 서로 다른 근무로 재면, 지각은 있는데 조퇴는 '예정 없음'인 줄이 나옵니다.
export function earlyBy(state:State,a:Attendance){return earlyOut(scheduledFor(state,a),a.start,a.end)}
// 조회 구간이 주(일요일 시작) 경계에 맞지 않으면 걸쳐 있는 주의 초과근무가 실제보다 적게 잡힙니다.
export function wholeWeeks(from:string,to:string){return weekStart(from)===from&&weekStart(addDays(to,1))===addDays(to,1)}
// 실근무시간을 정규·초과로 나눠 시급을 곱한 뒤 지각·조퇴한 만큼 차감합니다. 대체 근무에 붙는 추가수당은 없습니다 —
// 예전 대체 요청에 남아 있는 bonus 값도 급여에 더하지 않습니다.
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
// 급여에 넣는 시간은 예정 근무 시작부터입니다. 일찍 와서 찍어도 예정 시작 전 시간은 지급하지 않습니다.
// 예정 시작보다 12시간 넘게 앞선 출근은 일찍 온 것이 아니라 자정을 넘긴 근무에 늦게 온 것이라 그대로 둡니다
// (22:00 근무에 00:30 출근). 예정 근무가 없는 날의 기록은 기준이 없어 찍힌 그대로 셉니다.
export const EARLY_PAY_WINDOW_MINUTES=720;
export function paidStart(state:State,a:Attendance){const shift=scheduledFor(state,a);if(!shift)return a.start;const ahead=minutes(shift.start)-minutes(a.start);return ahead>0&&ahead<=EARLY_PAY_WINDOW_MINUTES?shift.start:a.start}
export const payableHours=(state:State,a:Attendance)=>duration(paidStart(state,a),a.end,a.breakMinutes);
export function payroll(state:State,employeeId:string,from:string,to:string){const e=state.employees.find(e=>e.id===employeeId)!;const records=paidRecords(state).filter(a=>a.employeeId===employeeId&&a.date>=from&&a.date<=to);const worked=(a:Attendance)=>payableHours(state,a);const hours=records.reduce((s,a)=>s+worked(a),0);
 // 날짜별로 합친 뒤 주(일요일 시작)별로 묶어 가산 시간을 구합니다.
 const byDay=new Map<string,number>();for(const a of records)byDay.set(a.date,(byDay.get(a.date)??0)+worked(a));const byWeek=new Map<string,number[]>();for(const [day,h] of byDay){const w=weekStart(day);byWeek.set(w,[...(byWeek.get(w)??[]),h])}
 const otHours=[...byWeek.values()].reduce((s,days)=>s+Math.max(0,days.reduce((n,h)=>n+h,0)-OT_WEEKLY_HOURS),0);const regularHours=hours-otHours;
 // 지각과 조퇴는 체크인 하나하나 따로 셉니다. 둘은 겹치지 않습니다 — 지각은 예정 출근부터 찍은 출근까지,
 // 조퇴는 찍은 퇴근부터 예정 퇴근까지라, 합치면 예정 근무 중 일하지 않은 시간 그대로입니다. 한 시간을 두 번 물리지 않습니다.
 // 차감은 둘을 합쳐 그 체크인에서 번 금액까지만입니다. 한 번 빠진 날이 다른 날 번 돈까지 갉아먹지 않습니다.
 // 한도에 걸리면 지각을 먼저 물리고 남은 만큼만 조퇴에서 뺍니다 — 합계는 어느 쪽을 먼저 물려도 같고,
 // 두 칸에 나눠 적는 자리만 갈립니다.
 const lates=records.map(a=>{const cap=worked(a)*e.rate;
  const minutes=lateBy(state,a)??0,early=earlyBy(state,a)??0;
  const deduction=Math.min(cap,(minutes/60)*e.rate);
  return {id:a.id,date:a.date,minutes,deduction,early,earlyDeduction:Math.min(cap-deduction,(early/60)*e.rate)}});
 const lateMinutes=lates.reduce((s,r)=>s+r.minutes,0);const lateDays=new Set(lates.filter(r=>r.minutes>0).map(r=>r.date)).size;
 const earlyMinutes=lates.reduce((s,r)=>s+r.early,0);const earlyDays=new Set(lates.filter(r=>r.early>0).map(r=>r.date)).size;
 const base=regularHours*e.rate,otPay=otHours*e.rate*OT_MULTIPLIER,earned=base+otPay,cents=(n:number)=>Math.round(n*100)/100;
 // 체크인마다 이미 그 체크인에서 번 금액으로 막아 두어, 엑셀 열을 잘못 연결해도 합계가 번 돈을 넘지 않습니다.
 const lateDeduction=lates.reduce((s,r)=>s+r.deduction,0),earlyDeduction=lates.reduce((s,r)=>s+r.earlyDeduction,0);
 return {hours,regularHours,otHours,lateMinutes,lateDays,earlyMinutes,earlyDays,lates:lates.map(r=>({...r,deduction:cents(r.deduction),earlyDeduction:cents(r.earlyDeduction)})),base:cents(base),otPay:cents(otPay),lateDeduction:cents(lateDeduction),earlyDeduction:cents(earlyDeduction),total:cents(earned-lateDeduction-earlyDeduction),...punchReviewCounts(state,employeeId,from,to)}}
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
// 한 사람이 맡은 직군 목록. roles 를 아직 저장하지 않은 예전 직원은 role 한 줄만 맡은 것으로 봅니다.
export type Roled = {role:string;roles?:string[]};
export function roleList(e:Roled):string[]{return e.roles?.length?e.roles:(e.role?[e.role]:[])}
// Proshop 과 Workshop 을 함께 맡는 사람을 부르는 이름. 따로 저장하는 값이 아니라 두 업무를 함께 든 사람에게 붙는 이름입니다.
// 그래서 예전에 저장된 근무·출퇴근의 장소와 그대로 맞물리고, 업무로 거르는 화면에서도 두 쪽 모두에 남습니다.
export const HYBRID_ROLE='Hybrid';
export const isHybrid=(e:Roled)=>AREAS.every(a=>roleList(e).includes(a));
// 화면에 적는 직군. 두 업무를 함께 맡으면 'Hybrid' 한 단어로 적고, 그 밖의 겸직은 ' · ' 로 나란히 적습니다.
export const roleLabel=(e:Roled)=>{const roles=roleList(e);return isHybrid(e)?[HYBRID_ROLE,...roles.filter(r=>!(AREAS as readonly string[]).includes(r))].join(' · '):roles.join(' · ')};
export const hasRole=(e:Roled,area:string)=>roleList(e).includes(area);
// Workshop 근무는 Workshop 업무를 맡은 사람(Hybrid 포함)에게만 넣습니다. 다른 업무는 누구에게나 넣을 수 있습니다.
export const RESTRICTED_AREAS:readonly string[]=['Workshop'];
export const canWorkIn=(e:Roled,area:string)=>!RESTRICTED_AREAS.includes(area)||hasRole(e,area);
// 한 직군만 맡은 사람과 구분해 표시할 때 씁니다.
export const isMultiRole=(e:Roled)=>roleList(e).length>1;
// 직원 구분 — Proshop, Workshop, 둘 다 맡는 Hybrid. 이름을 이 구분의 색으로 적어 한눈에 가려 봅니다.
// 두 업무 밖의 직군만 맡은 사람은 구분이 없어 평소 글자색 그대로 둡니다.
export type RoleGroup='Proshop'|'Workshop'|'Hybrid';
export const ROLE_GROUP_COLORS:Record<RoleGroup,string>={Proshop:'#1f63b5',Workshop:'#b35f0b',Hybrid:'#8a3db6'};
export function roleGroup(e:Roled):RoleGroup|null{if(isHybrid(e))return 'Hybrid';const roles=roleList(e);return (AREAS as readonly RoleGroup[]).find(a=>roles.includes(a))??null}
// 이름 글자에 입힐 색. 구분이 없거나 직원을 찾지 못하면 undefined 라 원래 색을 따릅니다.
export const roleTint=(e?:Roled|null)=>{const g=e&&roleGroup(e);return g?ROLE_GROUP_COLORS[g]:undefined};
// 드롭다운에서 직원을 구분별로 묶어 세우는 순서. 구분이 없는 사람은 맨 뒤 '기타'로 모입니다.
export const ROLE_GROUPS:RoleGroup[]=['Proshop','Workshop','Hybrid'];
// order 를 주면 그 순서로 묶음을 세웁니다 — 근무 추가에서 고른 업무의 직원을 맨 위로 올릴 때 씁니다.
export function groupByRole<T>(list:T[],groupOf:(x:T)=>RoleGroup|null|undefined,order:readonly RoleGroup[]=ROLE_GROUPS):{group:RoleGroup|null;items:T[]}[]{
 return [...order,null].map(group=>({group,items:list.filter(x=>(groupOf(x)??null)===group)})).filter(g=>g.items.length)}
export function seed():State{const names=['Josh','Grace','Claudio','Francis','James','Karen','Dylan','Dustin','Sam'];const colors=['#5579cf','#c48537','#20a69a','#9864c3','#e17b57','#5c9d61','#d26395','#628597','#a89643'];const employees=names.map((name,i)=>({id:'E'+String(i+1).padStart(3,'0'),name,color:colors[i],role:AREAS[i%AREAS.length],rate:0,email:'',birthDate:'',phone:'',punchId:String(1001+i)}));const week=weekStart(localDate(new Date()));const shifts:Shift[]=[];for(let d=0;d<7;d++) employees.forEach((e,i)=>{if((i+d)%4!==1) shifts.push({id:`s${d}-${i}`,employeeId:e.id,date:addDays(week,d),start:i%3===0?'10:00':i%3===1?'06:00':'12:00',end:i%3===0?'18:00':i%3===1?'14:00':'20:00',area:e.role})});
 // 지난 두 급여 기간과 이번 기간의 출퇴근 기록. 지난 기간은 이미 확인이 끝나 닫혀 있습니다.
 const today=localDate(new Date());const start=addDays(payPeriodStart(today),-2*PAY_PERIOD_DAYS);const punches:Punch[]=[];
 for(let d=0;d<3*PAY_PERIOD_DAYS;d++){const date=addDays(start,d);if(date>today)break;
  employees.forEach((e,i)=>{if((i+d)%4===1)return;const morning=(i+d)%2===0;
   const open=periodOpen(payPeriodStart(date),today);
   punches.push({id:`p${d}-${i}`,employeeId:e.id,date,in:morning?'07:57':'13:59',out:morning?'12:04':'19:35',area:e.role,
    status:open?'pending':'approved',...(open?{}:{reviewedAt:date+'T23:00:00.000Z'}),...(!open&&(i+d)%5===0?{editedBy:'manager'}:{})})})}
 return {employees,shifts,swaps:[],attendance:[],messages:[],tasks:[],timeOff:[],availability:[],punches,clockNames:[],currency:'CAD',published:false,publishedShifts:[]}}
