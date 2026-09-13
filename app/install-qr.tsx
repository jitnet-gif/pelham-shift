'use client';
import './install-qr.css';
import {useEffect,useMemo,useState} from 'react';
import {encode} from 'uqr';
import {QrCode,Copy,Check,Download} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
// Install entry point: QR of the team link for phones, plus the native prompt where the browser offers one (Android Chrome).
export default function InstallQr({team}:{team?:string}){
 const [open,setOpen]=useState(false);const [copied,setCopied]=useState(false);const [installer,setInstaller]=useState<InstallEvent|null>(null);
 useEffect(()=>{const capture=(e:Event)=>{e.preventDefault();setInstaller(e as InstallEvent)};window.addEventListener('beforeinstallprompt',capture);return()=>window.removeEventListener('beforeinstallprompt',capture)},[]);
 const url=open?window.location.origin+(team?'/?team='+encodeURIComponent(team):'/'):'';
 const qr=useMemo(()=>{if(!url)return null;const {data}=encode(url,{ecc:'M',border:2});return {size:data.length,path:data.flatMap((row,y)=>row.map((on,x)=>on?`M${x} ${y}h1v1h-1z`:'')).join('')}},[url]);
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{}}
 async function install(){if(!installer)return;await installer.prompt();await installer.userChoice;setInstaller(null)}
 return <><button className="button" onClick={()=>setOpen(true)}><QrCode size={17}/> 앱 설치 QR</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="shift-dialog install-dialog"><DialogTitle>휴대폰에 앱 설치</DialogTitle><DialogDescription>휴대폰 카메라로 QR 코드를 스캔해 접속한 뒤, 홈 화면에 추가하세요.</DialogDescription>{qr&&<svg className="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={'설치 주소 QR 코드: '+url} shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="#fff"/><path d={qr.path} fill="#000"/></svg>}<div className="installurl"><input readOnly value={url} aria-label="설치 주소" onFocus={e=>e.target.select()}/><button className="button" onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>}{copied?'복사됨':'복사'}</button></div><ol className="installsteps"><li><b>iPhone</b> · Safari로 열기 → 공유 버튼 → <b>홈 화면에 추가</b></li><li><b>Android</b> · Chrome으로 열기 → 메뉴(⋮) → <b>앱 설치</b> 또는 홈 화면에 추가</li><li>홈 화면 앱을 열고 로그인 → <b>푸시 알림 켜기</b></li></ol>{installer&&<button className="button primary submit" onClick={()=>void install()}><Download size={16}/> 이 기기에 바로 설치</button>}</DialogContent></Dialog></>;
}
