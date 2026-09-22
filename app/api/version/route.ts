// 지금 서버에 올라가 있는 배포를 한 줄로 알려 줍니다. 설치한 앱이 자기 버전과 비교할 때 씁니다.
export const dynamic='force-dynamic';
export async function GET(){
 const version=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||'dev';
 return Response.json({version},{headers:{'Cache-Control':'no-store'}});
}
