// 엑셀 출근기록 가져오기는 걷어냈습니다. 출퇴근은 단말에서 찍힌 기록(punches)으로 남습니다.
// 브라우저에 파일 하나를 내려 주는 helper 만 남깁니다 — 급여 CSV 내려받기가 씁니다.
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
