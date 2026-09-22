'use client';
import './install-qr.css';
import {useEffect,useMemo,useState} from 'react';
import {encode} from 'uqr';
import {QrCode,Copy,Check,Download,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {useLang} from './use-lang';
import {APPS,appAt,type AppKey} from './apps';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
// 홈 화면에 깔 수 있는 앱은 둘입니다. 스케줄 앱('/')과 출퇴근 앱('/attendance').
// 주소마다 manifest 가 다르고, 브라우저는 manifest 의 id 로 앱을 가릅니다 — 그래서 아이콘이 둘 생깁니다.
// 한 번에 둘을 깔 수는 없습니다: 설치 안내(beforeinstallprompt)는 지금 보고 있는 주소의 앱 하나에만 옵니다.
// 그래서 아래 토글로 앱을 고르고, 고른 앱의 주소에서 한 번씩 설치합니다.
export default function InstallQr({team,compact=false}:{team?:string;compact?:boolean}){
 const {t}=useLang();
 const [open,setOpen]=useState(false);const [copied,setCopied]=useState(false);const [installer,setInstaller]=useState<InstallEvent|null>(null);
 const [pick,setPick]=useState<AppKey>('shift');
 useEffect(()=>{const capture=(e:Event)=>{e.preventDefault();setInstaller(e as InstallEvent)};window.addEventListener('beforeinstallprompt',capture);return()=>window.removeEventListener('beforeinstallprompt',capture)},[]);
 const app=APPS.find(a=>a.key===pick)!;
 // 지금 열려 있는 주소가 어느 앱인지. 설치 안내는 이 앱 것만 와 있습니다.
 const here=open?appAt(window.location.pathname).key:'shift';
 const url=open?window.location.origin+app.path+(team?'?team='+encodeURIComponent(team):''):'';
 const qr=useMemo(()=>{if(!url)return null;const {data}=encode(url,{ecc:'M',border:2});return {size:data.length,path:data.flatMap((row,y)=>row.map((on,x)=>on?`M${x} ${y}h1v1h-1z`:'')).join('')}},[url]);
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{}}
 async function install(){if(!installer)return;await installer.prompt();await installer.userChoice;setInstaller(null)}
 return <><button className={compact?'button toolbutton':'button'} title={t('앱 설치 QR')} aria-label={t('앱 설치 QR')} onClick={()=>{setPick(appAt(window.location.pathname).key);setOpen(true)}}><QrCode size={17}/>{!compact&&' '+t('앱 설치 QR')}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="shift-dialog install-dialog"><DialogTitle>{t('휴대폰에 앱 설치')}</DialogTitle><DialogDescription>{t('앱은 두 개입니다. 하나씩 따로 설치하면 홈 화면에 아이콘이 두 개 생깁니다.')}</DialogDescription>
  <div className="segmented installpick" role="tablist" aria-label={t('설치할 앱')}>{APPS.map(a=><button key={a.key} type="button" role="tab" aria-selected={pick===a.key} className={pick===a.key?'on':''} onClick={()=>setPick(a.key)}><span className="installpick-icon" style={{backgroundImage:`url(${a.icon})`}}/>{t(a.name)}</button>)}</div>
  <p className="installnote">{t(app.note)}</p>
  {qr&&<svg className="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t('설치 주소 QR 코드: ')+url} shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="#fff"/><path d={qr.path} fill="#000"/></svg>}
  <div className="installurl"><input readOnly value={url} aria-label={t('설치 주소')} onFocus={e=>e.target.select()}/><button className="button" onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>}{copied?t('복사됨'):t('복사')}</button></div>
  <ol className="installsteps"><li><b>iPhone</b> · {t('Safari로 열기 → 공유 버튼 → ')}<b>{t('홈 화면에 추가')}</b></li><li><b>Android</b> · {t('Chrome으로 열기 → 메뉴(⋮) → ')}<b>{t('앱 설치')}</b>{t(' 또는 홈 화면에 추가')}</li><li>{t('나머지 앱은 위 토글로 바꿔 주소를 열고 같은 방법으로 한 번 더 설치하세요.')}</li><li>{t('홈 화면 앱을 열고 로그인 → ')}<b>{t('푸시 알림 켜기')}</b></li></ol>
  {pick===here
   ?installer&&<button className="button primary submit" onClick={()=>void install()}><Download size={16}/> {t('이 기기에 바로 설치')}</button>
   // 다른 앱은 그 주소에서만 설치됩니다. 먼저 옮겨 준 뒤 거기서 다시 이 창을 엽니다.
   :<button className="button submit" onClick={()=>window.location.assign(url)}><ExternalLink size={16}/> {t('이 앱 주소로 이동해 설치하기')}</button>}
  </DialogContent></Dialog></>;
}
