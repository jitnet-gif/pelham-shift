import {MAX_AREAS,MIN_WORKPLACE_RADIUS,MAX_WORKPLACE_RADIUS,OT_DAILY_HOURS,OT_WEEKLY_HOURS,type State,type Shift,type Attendance,type Punch,areaList,canSwap,leadDate,localDate,localTime,minutes,nameKey,overlap,overtimeOver,duration,payPeriodStart,payPeriodEnd,periodOpen} from './domain';
export type Actor={id:string;admin:boolean};
export type Command={type:string;payload:any};
const fail=(message:string):never=>{throw new Error(message)};
function text(value:unknown,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)fail('필수 입력값을 확인하세요.');return (value as string).trim()}
function date(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00Z').toISOString().slice(0,10)!==value)fail('날짜를 확인하세요.');return value}
function time(value:string,stepped=false){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)||(stepped&&Number(value.slice(3))%10!==0))fail(stepped?'근무시간은 10분 단위로 입력하세요.':'시간 형식을 확인하세요.');return value}
// 작업 지시의 마감 시각은 10분 단위로만 받습니다 — 화면 시계가 세워 주는 눈금과 같아야 합니다.
function tenMinute(value:unknown){const v=typeof value==='string'?value:'';if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)||Number(v.slice(3))%10)fail('마감 시각은 10분 단위로 고르세요.');return v}
function number(value:unknown,max=1000000){const n=Number(value);if(!Number.isFinite(n)||n<0||n>max)fail('0 이상의 유효한 금액/시간을 입력하세요.');return n}
// 직군은 겸할 수 있습니다 — 화면은 고른 직군을 쉼표로 묶어 보냅니다.
// 첫째 직군이 그 사람의 기본 업무가 되어, 근무와 출퇴근이 장소를 하나만 적을 때 쓰입니다.
function roleInput(value:unknown,fallback:unknown):string[]{
 const clean=(list:unknown[])=>[...new Set(list.map(v=>(typeof v==='string'?v:'').trim().slice(0,60)).filter(Boolean))].slice(0,MAX_AREAS);
 const picked=clean(Array.isArray(value)?value:typeof value==='string'?value.split(','):[]);
 const roles=picked.length?picked:clean([fallback]);
 if(!roles.length)fail('업무를 하나 이상 고르세요.');
 return roles;
}
export function applyCommand(current:State,command:Command,actor:Actor,now=new Date()):State{
 const s=structuredClone(current),p=command.payload??{},id=()=>crypto.randomUUID();s.tasks??=[];s.timeOff??=[];s.availability??=[];s.punches??=[];s.clockNames??=[];const admin=()=>{if(!actor.admin)fail('관리자 권한이 필요합니다.')};const employee=(v:string)=>s.employees.find(e=>e.id===v)??fail('등록된 직원을 선택하세요.');
 // 관리자는 공용 단말에서 직원 대신 찍어 줄 수 있고, 직원은 본인 것만 찍습니다.
 const spotOf=(v:Record<string,unknown>)=>{const lat=Number(v.lat),lng=Number(v.lng),acc=Number(v.accuracy);return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180?{lat,lng,...(Number.isFinite(acc)&&acc>=0?{accuracy:Math.round(acc)}:{})}:undefined};
 const punchTarget=(v:unknown)=>{const wanted=typeof v==='string'&&v?v:actor.id;if(!actor.admin&&wanted!==actor.id)fail('본인 출퇴근만 찍을 수 있습니다.');return employee(wanted).id};
 // Staff are read-only except for their own tasks and messages. Staff with task permission also run the schedule:
 // they assign tasks, add a job, put shifts in, take them out and take the schedule public.
 // Payroll and staff records stay with the administrator.
 const taskManager=actor.admin||!!s.employees.find(e=>e.id===actor.id)?.taskManager;
 const scheduler=()=>{if(!taskManager)fail('작업 지시 권한이 필요합니다.')};
 // 초과 근무 편성은 따로 엽니다. 근무표는 짜도 하루 8시간·주 40시간을 넘기는 근무는 이 권한을 받은 사람만 냅니다.
 // 근무를 s 에 반영한 뒤에, 손대기 전 모습(before)과 견주어 부릅니다. 이미 넘어 있던 근무의 장소나 메모를
 // 고치는 것까지 막으면 예전에 짜 둔 근무표를 손볼 수 없게 되므로, 이번 편성이 더 넘긴 자리만 막습니다.
 // 막히면 그 자리에서 throw 되고, 손대던 s 는 복제본이라 그대로 버려집니다.
 const overtimeManager=actor.admin||!!s.employees.find(e=>e.id===actor.id)?.overtimeManager;
 const withinOvertime=(before:Shift[],employeeId:string,dates:string[])=>{
  if(overtimeManager)return;
  const was=overtimeOver(before,employeeId,dates);
  for(const [key,hours] of overtimeOver(s.shifts,employeeId,dates)){
   // 분 단위로 세다 보면 소수점 끝자리가 흔들립니다. 1분(0.017시간)보다 적게 늘어난 것은 늘어난 것으로 보지 않습니다.
   if(hours<=(was.get(key)??0)+0.001)continue;
   const name=employee(employeeId).name,extra=Math.round(hours*100)/100,day=key.slice(2);
   fail(key.startsWith('w')
    ?`${day} 주 ${name}: 주 ${OT_WEEKLY_HOURS}시간을 ${extra}시간 넘깁니다. 초과 근무 편성 권한이 필요합니다.`
    :`${day} ${name}: 하루 ${OT_DAILY_HOURS}시간을 ${extra}시간 넘깁니다. 초과 근무 편성 권한이 필요합니다.`);
  }
 };
 const MANAGED=['taskCreate','taskRemove','areaAdd','shift','shiftUpdate','shiftRemove','publish','unpublish'];
 if(!actor.admin&&!['taskUpdate','message','read','timeOffRequest','timeOffDecision','availabilitySet','availabilityDecision','punchIn','punchOut','punchBreak','punchReview','punchApproveAll'].includes(command.type)&&!(MANAGED.includes(command.type)&&taskManager))fail('직원 계정은 전체 일정, 본인 근태 및 급여를 읽기 전용으로만 볼 수 있습니다.');
 switch(command.type){
 case 'employee': {admin();const prev=s.employees.find(x=>x.id===p.id);const roles=roleInput(p.roles,p.role);const e={id:p.id||id(),name:text(p.name,80),color:text(p.color,7),role:roles[0],roles,email:String(p.email||'').trim().toLowerCase(),birthDate:String(p.birthDate||'').trim(),phone:String(p.phone||'').trim(),punchId:String(p.punchId||'').trim(),rate:number(p.rate),taskManager:p.taskManager===true||p.taskManager==='1',overtimeManager:p.overtimeManager===true||p.overtimeManager==='1',admin:p.admin===true||p.admin==='1',archived:prev?.archived};if(!/^#[0-9a-f]{6}$/i.test(e.color))fail('직원 색상을 확인하세요.');if(e.phone&&!/^[0-9+()\-\s]{7,30}$/.test(e.phone))fail('연락처를 확인하세요. 숫자와 + - ( ) 만 입력할 수 있습니다.');if(!/^\d{4,8}$/.test(e.punchId||''))fail('직원 ID는 숫자 4~8자리로 입력하세요.');if(s.employees.some(x=>x.id!==e.id&&!x.archived&&x.punchId===e.punchId))fail('이미 쓰이고 있는 직원 ID 입니다.');if(e.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email))fail('이메일을 확인하세요.');if(e.birthDate&&!/^\d{8}$/.test(e.birthDate))fail('생년월일 8자리를 입력하세요.');if(e.email&&s.employees.some(x=>x.id!==e.id&&!x.archived&&x.email===e.email))fail('이미 등록된 이메일입니다.');if(e.birthDate&&s.employees.some(x=>x.id!==e.id&&!x.archived&&x.birthDate===e.birthDate))fail('같은 생년월일이 이미 등록되어 있습니다.');s.employees=s.employees.filter(x=>x.id!==e.id).concat(e);break;}
 // 삭제한 직원은 지난 근무·출근·급여 기록이 이름을 잃지 않도록 지우지 않고 감춥니다.
 // 아직 번호가 없는 직원에게 한 번에 번호를 내어 줍니다. 이미 쓰는 번호는 건너뜁니다.
 case 'employeeIds': {admin();const used=new Set(s.employees.map(e=>e.punchId).filter(Boolean));let next=1001;
  const empty=s.employees.filter(e=>!e.archived&&!e.punchId);
  if(!empty.length)fail('모든 직원에게 이미 직원 ID 가 있습니다.');
  for(const e of empty){while(used.has(String(next))){next++;if(next>99999999)fail('쓸 수 있는 번호가 없습니다.')}e.punchId=String(next);used.add(e.punchId)}break;}
 case 'employeeRemove': {admin();const e=employee(p.id);if(e.id===actor.id)fail('본인 계정은 삭제할 수 없습니다.');s.employees=s.employees.map(x=>x.id===e.id?{...x,archived:true,admin:false}:x);break;}
 // 완전 삭제. 위의 삭제가 이름을 남기는 삭제라면 이쪽은 흔적까지 지웁니다 — 근무·출퇴근·급여·작업·메시지가 함께 사라지고 되돌릴 수 없습니다.
 // 남의 줄에 이름만 얹혀 있던 자리(대체 원 근무자, 읽음 표시, 지시한 사람, 고친 사람)는 줄을 지우지 않고 그 이름만 떼어 냅니다.
 case 'employeePurge': {admin();const gone=employee(p.id).id;if(gone===actor.id)fail('본인 계정은 삭제할 수 없습니다.');
  s.employees=s.employees.filter(x=>x.id!==gone);
  s.shifts=s.shifts.filter(x=>x.employeeId!==gone);for(const x of s.shifts)if(x.originalId===gone)delete x.originalId;
  const alive=new Set(s.shifts.map(x=>x.id));s.swaps=s.swaps.filter(x=>x.from!==gone&&x.to!==gone&&alive.has(x.shiftId));
  s.attendance=s.attendance.filter(x=>x.employeeId!==gone);
  s.messages=s.messages.filter(x=>x.sender!==gone&&x.to!==gone).map(x=>({...x,readBy:(x.readBy??[]).filter(v=>v!==gone),...(x.recipients?{recipients:x.recipients.filter(v=>v!==gone)}:{})})).filter(x=>!x.recipients||x.recipients.length>0);
  s.tasks=s.tasks.filter(x=>x.assignedTo!==gone);for(const x of s.tasks)if(x.createdBy===gone)delete x.createdBy;
  s.timeOff=s.timeOff!.filter(x=>x.employeeId!==gone);
  s.availability=s.availability!.filter(x=>x.employeeId!==gone);
  s.punches=s.punches!.filter(x=>x.employeeId!==gone);for(const x of s.punches)if(x.editedBy===gone)delete x.editedBy;
  s.clockNames=s.clockNames!.filter(x=>x.employeeId!==gone);
  break;}
 case 'shift': {scheduler();employee(p.employeeId);const shift:Shift={id:id(),employeeId:p.employeeId,date:date(p.date),start:time(p.start,true),end:time(p.end,true),area:text(p.area,60),note:p.note?text(p.note,250):undefined,breakMinutes:p.breakMinutes?number(p.breakMinutes,720):undefined,draft:true};if(!duration(shift.start,shift.end))fail('출근과 퇴근 시간이 같습니다.');if((shift.breakMinutes??0)>=duration(shift.start,shift.end)*60)fail('휴게시간이 근무시간보다 깁니다.');if(s.shifts.some(x=>x.employeeId===shift.employeeId&&overlap(x,shift)))fail('해당 직원의 근무시간이 겹칩니다.');const before=[...s.shifts];s.shifts.push(shift);withinOvertime(before,shift.employeeId,[shift.date]);s.published=false;break;}
 case 'shiftUpdate': {scheduler();const ids=[...new Set(String(p.ids||'').split(',').filter(Boolean))];if(!ids.length)fail('수정할 근무를 선택하세요.');if(ids.length>1000)fail('한 번에 최대 1,000개 근무를 수정할 수 있습니다.');const single=ids.length===1;const start=p.start?time(p.start,true):'',end=p.end?time(p.end,true):'',area=p.area?text(p.area,60):'',day=single&&p.date?date(p.date):'',note=single&&p.note!==undefined?String(p.note).trim().slice(0,250):null,rest=single&&p.breakMinutes!==undefined?number(p.breakMinutes,720):null;if(!start&&!end&&!area&&!day&&note===null&&rest===null)fail('변경할 내용을 입력하세요.');const targets=ids.map(v=>s.shifts.find(x=>x.id===v)??fail('근무를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.'));
  // 고치기 전 모습. 아래에서 targets 를 제자리에서 손대므로, 견줄 값은 지금 떠 두어야 합니다.
  const before=s.shifts.map(x=>({...x}));
  // Edit every target first, then check overlaps, so shifts moved together are compared at their new times and never against themselves.
  for(const x of targets){if(s.swaps.some(r=>r.shiftId===x.id&&(r.status==='requested'||r.status==='accepted')))fail(`${x.date}: 진행 중인 대체근무 요청이 있어 수정할 수 없습니다.`);if(start)x.start=start;if(end)x.end=end;if(area)x.area=area;if(day)x.date=day;if(note!==null)x.note=note||undefined;if(rest!==null)x.breakMinutes=rest||undefined;if((x.breakMinutes??0)>=duration(x.start,x.end)*60)fail('휴게시간이 근무시간보다 깁니다.');if(!duration(x.start,x.end))fail(`${x.date}: 출근과 퇴근 시간이 같습니다.`)}
  for(const x of targets)if(s.shifts.some(y=>y.id!==x.id&&y.employeeId===x.employeeId&&overlap(x,y)))fail(`${x.date} ${employee(x.employeeId).name}: 근무시간이 겹칩니다.`);
  // 옮겨 간 날만 셉니다. 근무를 빼 온 날은 시간이 줄어들 뿐이라 볼 것이 없습니다.
  const touched=new Map<string,string[]>();for(const x of targets)touched.set(x.employeeId,[...(touched.get(x.employeeId)??[]),x.date]);
  for(const [who,dates] of touched)withinOvertime(before,who,dates);
  // 고친 근무도 다시 공개하기 전까지 Unpublished 딱지를 답니다.
  for(const x of targets)x.draft=true;
  s.published=false;break;}
 // 근무 삭제는 근무를 편성하는 사람의 몫입니다. 진행 중인 대체근무 요청이 있으면 먼저 정리해야 지울 수 있고,
 // 지운 근무에 딸린 대체 기록은 빈 줄로 남지 않도록 함께 치웁니다.
 // 지우기는 공개 상태를 건드리지 않습니다 — 근무 하나를 지우려다 온 팀의 스케줄이 가려지면 안 되기 때문입니다.
 case 'shiftRemove': {scheduler();const shift=s.shifts.find(x=>x.id===text(p.id,120))??fail('근무를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.');if(s.swaps.some(r=>r.shiftId===shift.id&&(r.status==='requested'||r.status==='accepted')))fail(`${shift.date}: 진행 중인 대체근무 요청이 있어 삭제할 수 없습니다.`);s.shifts=s.shifts.filter(x=>x.id!==shift.id);s.swaps=s.swaps.filter(r=>r.shiftId!==shift.id);break;}
 // 출퇴근을 찍을 수 있는 자리. 푸는 것은 끄기가 아니라 클럽 기본 자리(1km)로 되돌리기입니다 —
 // 어디서든 찍을 수 있던 예전 방식으로는 돌아가지 않습니다.
 case 'workplace': {admin();
  if(p.clear==='1'||p.clear===true){s.workplace=undefined;break}
  const lat=Number(p.lat),lng=Number(p.lng),radius=Math.round(Number(p.radius));
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)fail('위치를 확인하세요.');
  if(!Number.isFinite(radius)||radius<MIN_WORKPLACE_RADIUS||radius>MAX_WORKPLACE_RADIUS)fail(`반경은 ${MIN_WORKPLACE_RADIUS}~${MAX_WORKPLACE_RADIUS}m 로 입력하세요.`);
  s.workplace={lat,lng,radius};break;}
 // 공개하면 모든 근무의 Unpublished 딱지를 뗍니다.
 case 'publish':scheduler();s.published=true;for(const x of s.shifts)delete x.draft;break;
 // 게시 해제는 끄기일 뿐 지우기가 아닙니다. 근무표도 기록도 그대로 남고 직원 화면에서만 사라집니다.
 // 딱지는 '지난 공개 뒤에 새로 넣거나 고친 근무'라는 뜻이므로 여기서는 건드리지 않습니다.
 case 'unpublish':scheduler();s.published=false;break;
 case 'currency':admin();if(!['CAD'].includes(p.currency))fail('통화를 선택하세요.');s.currency=p.currency;break;
 case 'swap': {const shift=s.shifts.find(x=>x.id===p.shiftId)??fail('근무를 선택하세요.');if(!actor.admin&&shift.employeeId!==actor.id)fail('본인 근무만 대체 신청할 수 있습니다.');if(!canSwap(shift.date))fail('대체 신청은 근무일 7일 전까지 가능합니다.');employee(p.to);if(p.to===shift.employeeId)fail('다른 대체 직원을 선택하세요.');if(shift.originalId)fail('이미 대체 승인된 근무입니다.');if(s.swaps.some(x=>x.shiftId===shift.id&&x.status!=='rejected'))fail('이미 대체 요청이 있습니다.');if(s.shifts.some(x=>x.employeeId===p.to&&overlap(x,shift)))fail('대체 직원의 기존 근무시간과 겹칩니다.');s.swaps.push({id:id(),shiftId:shift.id,from:shift.employeeId,to:p.to,status:'requested',createdAt:now.toISOString(),bonus:0});break;}
 case 'swapDecision': {const r=s.swaps.find(x=>x.id===p.id)??fail('요청을 찾을 수 없습니다.');if(p.action==='accept'){if(actor.admin||actor.id!==r.to)fail('대체 직원 본인이 수락해야 합니다.');if(r.status!=='requested')fail('처리된 요청입니다.');r.status='accepted'}else if(p.action==='reject'){if(!actor.admin&&actor.id!==r.to&&actor.id!==r.from)fail('권한이 없습니다.');if(r.status==='approved')fail('승인된 대체는 취소할 수 없습니다.');r.status='rejected'}else if(p.action==='approve'){admin();if(r.status!=='accepted')fail('대체 직원의 수락이 먼저 필요합니다.');const shift=s.shifts.find(x=>x.id===r.shiftId)??fail('근무가 없습니다.');if(!canSwap(shift.date))fail('대체 승인도 근무일 7일 전까지 가능합니다.');if(shift.employeeId!==r.from)fail('원래 근무자가 변경되었습니다.');if(s.shifts.some(x=>x.id!==shift.id&&x.employeeId===r.to&&overlap(x,shift)))fail('대체 직원의 근무시간이 겹칩니다.');shift.originalId=r.from;shift.employeeId=r.to;r.bonus=number(p.bonus);r.status='approved'}else fail('잘못된 처리입니다.');break;}
 // 펀치는 서버 시각으로 남깁니다. 기기 시계를 고쳐도 찍히는 시각은 달라지지 않습니다.
 case 'punchIn': {const target=punchTarget(p.employeeId);const day=localDate(now),at=localTime(now);
  // 퇴근을 찍지 않은 채 날이 바뀌어도 새 날의 출근은 찍힙니다. 어제 기록이 오늘을 막지 않도록 오늘 찍은 출근만 봅니다.
  // 닫히지 않은 어제 기록은 그대로 남아 '퇴근 미기록'으로 보이며, 급여는 퇴근까지 찍힌 것만 셉니다.
  if(s.punches!.some(x=>x.employeeId===target&&!x.out&&x.date===day))fail('이미 출근으로 찍혀 있습니다. 먼저 퇴근을 찍으세요.');const who=employee(target);if(who.punchId&&!actor.admin&&String(p.punchId||'')!==who.punchId)fail('직원 ID가 맞지 않습니다.');const near=s.shifts.filter(x=>x.employeeId===target&&x.date===day).sort((x,y)=>Math.abs(minutes(x.start)-minutes(at))-Math.abs(minutes(y.start)-minutes(at)))[0];s.punches!.push({id:id(),employeeId:target,date:day,in:at,area:near?.area||employee(target).role,...(p.photoAt?{photoAt:String(p.photoAt)}:{}),...(spotOf(p)?{spot:spotOf(p)}:{}),status:'pending'});break;}
 case 'punchOut': {const target=punchTarget(p.employeeId);const open=[...s.punches!].reverse().find(x=>x.employeeId===target&&!x.out)??fail('출근으로 찍힌 기록이 없습니다.');const running=(open.breaks??[]).find(b=>!b.end);if(running)running.end=localTime(now);open.out=localTime(now);if(p.photoAt)open.outPhotoAt=String(p.photoAt);const out=spotOf(p);if(out)open.outSpot=out;open.status??='pending';break;}
 // 휴게 시작과 종료. 유급 휴게는 근무시간에 그대로 남고 무급 휴게만 빠집니다.
 case 'punchBreak': {const target=punchTarget(p.employeeId);const open=[...s.punches!].reverse().find(x=>x.employeeId===target&&!x.out)??fail('출근으로 찍힌 기록이 없습니다.');open.breaks??=[];const running=open.breaks.find(b=>!b.end);
  if(p.action==='end'){(running??fail('휴게 중이 아닙니다.')).end=localTime(now)}
  else if(p.action==='start'){if(running)fail('이미 휴게 중입니다.');if(open.breaks.length>=12)fail('휴게는 하루 12번까지 찍을 수 있습니다.');open.breaks.push({start:localTime(now),paid:p.paid===true||p.paid==='1'})}
  else fail('잘못된 휴게 처리입니다.');break;}
 // 직원이 자기 근무 기록을 확인합니다. 지난 급여 기간은 이미 지급이 끝나 손댈 수 없습니다.
 case 'punchReview': {const punch:Punch=s.punches!.find(x=>x.id===text(p.id,120))??fail('근무 기록을 찾을 수 없습니다.');
  if(!actor.admin&&punch.employeeId!==actor.id)fail('본인 근무 기록만 확인할 수 있습니다.');
  if(!punch.out)fail('퇴근까지 찍힌 근무만 확인할 수 있습니다.');
  if(!periodOpen(payPeriodStart(punch.date),localDate(now)))fail('마감된 근무표입니다. 관리자에게 문의하세요.');
  if(p.action==='approve'){punch.status='approved';punch.disputeNote=undefined}
  else if(p.action==='dispute'){punch.status='disputed';punch.disputeNote=String(p.note||'').trim().slice(0,500)}
  else fail('잘못된 처리입니다.');punch.reviewedAt=now.toISOString();break;}
 // 한 급여 기간에 남은 확인을 한 번에 끝냅니다.
 case 'punchApproveAll': {const from=date(p.from),to=payPeriodEnd(from);
  if(from!==payPeriodStart(from))fail('급여 기간의 시작일이 아닙니다.');
  if(!periodOpen(from,localDate(now)))fail('마감된 근무표입니다. 관리자에게 문의하세요.');
  const who=actor.admin&&p.employeeId?employee(p.employeeId).id:actor.id;
  const mine=s.punches!.filter(x=>x.employeeId===who&&x.date>=from&&x.date<=to&&x.out&&x.status!=='approved');
  if(!mine.length)fail('확인할 근무가 없습니다.');
  for(const punch of mine){punch.status='approved';punch.disputeNote=undefined;punch.reviewedAt=now.toISOString()}break;}
 // 출근기계 이름과 직원을 한 번 승인해 두면 다음 타임카드부터 자동으로 이어집니다. 비슷한 이름은 후보로만 제안하고, 확정은 관리자가 합니다.
 case 'clockName': {admin();const who=employee(p.employeeId).id;const key=nameKey(text(p.name,80));if(!key)fail('출근기계에 찍힌 이름을 확인하세요.');const rest=s.clockNames!.filter(x=>x.name!==key);if(rest.length>=500)fail('이름 연결은 500개까지 저장할 수 있습니다.');s.clockNames=[...rest,{name:key,raw:text(p.name,80),employeeId:who}];break;}
 // 잘못 승인한 연결은 지워야 다시 후보로 올라옵니다.
 case 'clockNameRemove': {admin();const key=nameKey(text(p.name,80));const rest=s.clockNames!.filter(x=>x.name!==key);if(rest.length===s.clockNames!.length)fail('저장된 이름 연결이 아닙니다.');s.clockNames=rest;break;}
 case 'attendance': {admin();if(!Array.isArray(p.rows)||!p.rows.length||p.rows.length>3000)fail('1~3,000개 행을 가져올 수 있습니다.');for(const row of p.rows){employee(row.employeeId);const a:Attendance={id:id(),employeeId:row.employeeId,date:date(row.date),start:time(row.start),end:time(row.end),breakMinutes:number(row.breakMinutes,1440)};if(!duration(a.start,a.end)||a.breakMinutes>=duration(a.start,a.end)*60)fail('퇴근 시간과 휴게시간을 확인하세요.');const shift={...a,area:''};if(s.attendance.some(x=>x.employeeId===a.employeeId&&overlap({...x,area:''},shift)))fail(`${a.date} ${a.employeeId}: 중복 또는 겹치는 출근기록입니다.`);s.attendance.push(a)}break;}
 case 'message': {if(!actor.admin&&p.to!=='admin')fail('직원은 관리자에게만 메시지를 보낼 수 있습니다.');if(p.to!=='admin'&&p.to!=='all')employee(p.to);if(p.to==='all')admin();s.messages.push({id:id(),sender:actor.id,to:p.to,body:text(p.body,2000),createdAt:now.toISOString(),readBy:[actor.id],kind:'message'});break;}
 case 'rain': {admin();const end=time(p.end,true);const ids=p.targets===undefined?s.employees.map(e=>e.id):[...new Set(String(p.targets).split(',').filter(Boolean))];if(!ids.length)fail('공지를 받을 직원을 선택하세요.');const names=ids.map(v=>employee(v).name);const all=s.employees.every(e=>ids.includes(e.id));s.messages.push({id:id(),sender:actor.id,to:'all',...(all?{}:{recipients:ids}),body:`[우천 근무 종료] ${date(p.date)} ${end}에 ${all?'전 직원':names.join(', ')} 근무를 종료합니다. ${text(p.body,1000)}`,createdAt:now.toISOString(),readBy:[actor.id],kind:'rain'});break;}
 // 직원이 관리자에게 보낸 메시지는 to 가 'admin' 이라 관리자 본인 id 와 같지 않습니다. 관리자라면 받는 사람으로 봅니다.
 // 대화 하나를 열면 그 안의 안 읽은 메시지를 한꺼번에 읽음으로 올립니다. ids 로 여러 개, id 로 하나를 받습니다.
 case 'read': {const ids:string[]=Array.isArray(p.ids)?p.ids.map(String):[String(p.id)];for(const one of ids){const m=s.messages.find(x=>x.id===one)??fail('메시지가 없습니다.');const mine=m.to==='all'?!m.recipients||m.recipients.includes(actor.id):m.to==='admin'?actor.admin:m.to===actor.id;if(!mine&&m.sender!==actor.id)fail('권한이 없습니다.');if(!m.readBy.includes(actor.id))m.readBy.push(actor.id);}break;}
 // 메시지 삭제는 관리자만 할 수 있습니다. 지우면 직원 화면에서도 함께 사라집니다.
 case 'messageRemove': {admin();const m=s.messages.find(x=>x.id===text(p.id,120))??fail('메시지가 없습니다.');s.messages=s.messages.filter(x=>x.id!==m.id);break;}
 // 업무(직무)는 늘리기만 합니다 — 근무·출퇴근 기록이 이름을 그대로 들고 있어, 지우면 지난 기록이 가리킬 곳을 잃습니다.
 case 'areaAdd': {if(!taskManager)fail('작업 지시 권한이 필요합니다.');const area=text(p.name,60);const list=areaList(s);if(list.some(a=>nameKey(a)===nameKey(area)))fail('이미 있는 업무입니다.');if(list.length>=MAX_AREAS)fail('업무는 40개까지 만들 수 있습니다.');s.areas=[...list,area];break;}
 case 'taskCreate': {if(!taskManager)fail('작업 지시 권한이 필요합니다.');const assignedTo=text(p.assignedTo,80);employee(assignedTo);s.tasks.push({id:id(),assignedTo,title:text(p.title,160),notes:typeof p.notes==='string'?p.notes.trim().slice(0,2000):'',date:date(p.date),...(p.time?{time:tenMinute(p.time)}:{}),status:'sent',createdAt:now.toISOString(),createdBy:actor.id});break;}
 // 작업 지시는 낸 사람이 거두어 갑니다. 관리자는 누가 낸 것이든 지울 수 있고,
 // 지시한 사람이 적혀 있지 않은 옛 작업은 관리자만 지울 수 있습니다.
 case 'taskRemove': {const task=s.tasks.find(x=>x.id===text(p.id,120))??fail('작업을 찾을 수 없습니다.');if(!actor.admin&&task.createdBy!==actor.id)fail('본인이 지시한 작업만 삭제할 수 있습니다.');s.tasks=s.tasks.filter(x=>x.id!==task.id);break;}
 case 'taskUpdate': {const task=s.tasks.find(x=>x.id===text(p.id,120))??fail('작업을 찾을 수 없습니다.');if(!actor.admin&&task.assignedTo!==actor.id)fail('본인에게 배정된 작업만 처리할 수 있습니다.');if(p.action==='seen'){if(task.status==='sent')task.status='seen'}else if(p.action==='complete'){task.status='completed';task.completedAt=now.toISOString()}else fail('잘못된 작업 처리입니다.');break;}
 // Staff request time off / unavailability for themselves (pending); a manager's entries are approved on creation.
 case 'timeOffRequest': {const who=actor.admin?employee(p.employeeId).id:employee(actor.id).id;const from=date(p.from),to=date(p.to||p.from);if(to<from)fail('종료일이 시작일보다 빠릅니다.');if(!actor.admin&&from<leadDate(localDate(now)))fail('휴무 신청은 시작일 7일 전까지 가능합니다.');if((Date.parse(to)-Date.parse(from))/86400000>61)fail('휴무는 한 번에 최대 62일까지 신청할 수 있습니다.');const allDay=p.allDay===true||p.allDay==='1';let start:string|undefined,end:string|undefined;if(!allDay){if(from!==to)fail('시간 단위 휴무는 하루만 신청할 수 있습니다.');start=time(p.start,true);end=time(p.end,true);if(!duration(start,end))fail('출근과 퇴근 시간이 같습니다.')}if(s.timeOff.some(r=>r.employeeId===who&&r.status!=='declined'&&r.from<=to&&from<=r.to))fail('이미 신청한 휴무와 날짜가 겹칩니다.');s.timeOff.push({id:id(),employeeId:who,from,to,allDay,start,end,reason:String(p.reason||'').trim().slice(0,500),status:actor.admin?'approved':'pending',createdAt:now.toISOString(),...(actor.admin?{decidedAt:now.toISOString()}:{})});break;}
 case 'timeOffDecision': {const r=s.timeOff.find(x=>x.id===p.id)??fail('휴무 요청을 찾을 수 없습니다.');if(p.action==='cancel'){if(!actor.admin&&r.employeeId!==actor.id)fail('권한이 없습니다.');if(!actor.admin&&r.status!=='pending')fail('승인된 휴무는 관리자에게 취소를 요청하세요.');s.timeOff=s.timeOff.filter(x=>x.id!==r.id)}else if(p.action==='approve'||p.action==='decline'){admin();if(r.status!=='pending')fail('처리된 요청입니다.');r.status=p.action==='approve'?'approved':'declined';r.decidedAt=now.toISOString()}else fail('잘못된 처리입니다.');break;}
 case 'availabilitySet': {const who=actor.admin?employee(p.employeeId).id:employee(actor.id).id;const weekday=Number(p.weekday);if(!Number.isInteger(weekday)||weekday<0||weekday>6||p.weekday===''||p.weekday===undefined)fail('요일을 선택하세요.');const allDay=p.allDay===true||p.allDay==='1';let start:string|undefined,end:string|undefined;if(!allDay){start=time(p.start,true);end=time(p.end,true);if(!duration(start,end))fail('출근과 퇴근 시간이 같습니다.')}if(s.availability.some(r=>r.employeeId===who&&r.weekday===weekday&&r.status!=='declined'))fail('같은 요일에 이미 등록된 근무 불가 시간이 있습니다. 기존 항목을 삭제한 뒤 다시 등록하세요.');s.availability.push({id:id(),employeeId:who,weekday,allDay,start,end,note:String(p.note||'').trim().slice(0,200),effectiveFrom:actor.admin?localDate(now):leadDate(localDate(now)),status:actor.admin?'approved':'pending',createdAt:now.toISOString(),...(actor.admin?{decidedAt:now.toISOString()}:{})});break;}
 case 'availabilityDecision': {const r=s.availability.find(x=>x.id===p.id)??fail('근무 불가 시간을 찾을 수 없습니다.');if(p.action==='delete'){if(!actor.admin&&r.employeeId!==actor.id)fail('권한이 없습니다.');s.availability=s.availability.filter(x=>x.id!==r.id)}else if(p.action==='approve'||p.action==='decline'){admin();if(r.status!=='pending')fail('처리된 요청입니다.');r.status=p.action==='approve'?'approved':'declined';r.decidedAt=now.toISOString()}else fail('잘못된 처리입니다.');break;}
 default:fail('지원하지 않는 요청입니다.');
 }return s;
}
