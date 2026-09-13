'use client';
import {useEffect,useState} from 'react';
import {ClipboardList} from 'lucide-react';
export default function TaskLaunch(){const [href,setHref]=useState('/tasks');const [show,setShow]=useState(false);useEffect(()=>{setShow(window.location.pathname!=='/tasks');setHref('/tasks'+window.location.search)},[]);if(!show)return null;return <a className="task-launch" href={href}><ClipboardList size={18}/> 작업 수신함</a>}
