// 출퇴근 사진이 '사진'인지만 봅니다. 무엇이 찍혔는지는 단말 화면에서 먼저 걸러 옵니다.
// 화면과 서버 양쪽에서 같은 기준을 쓰려고 따로 두었습니다.
const PREFIX='data:image/jpeg;base64,';
// 줄인 사진의 크기 범위. 너무 작으면 빈 화면이고, 너무 크면 줄이기가 안 된 원본입니다.
export const MIN_PHOTO_BYTES=1_200,MAX_PHOTO_BYTES=300_000;
export function photoBytes(value:unknown){
 if(typeof value!=='string'||!value.startsWith(PREFIX))return null;
 const body=value.slice(PREFIX.length);
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(body))return null;
 const size=Math.floor(body.length*3/4)-(body.endsWith('==')?2:body.endsWith('=')?1:0);
 if(size<MIN_PHOTO_BYTES||size>MAX_PHOTO_BYTES)return null;
 // JPEG 은 언제나 FF D8 FF 로 시작합니다. base64 로는 '/9j/' 입니다.
 return body.startsWith('/9j/')?value:null}
