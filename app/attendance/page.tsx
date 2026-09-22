import { redirect } from 'next/navigation';

// 출퇴근은 앱 안 홈 탭으로 합쳤습니다. 이 주소는 홈 화면에 추가해 둔 사람이나 북마크가 있을 수 있어,
// 없는 주소로 두지 않고 앱 첫 화면으로 넘깁니다. team 같은 주소 뒤 값은 그대로 들고 갑니다.
export const dynamic = 'force-dynamic';

export default async function AttendanceMoved({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const rest = query.toString();
  redirect('/' + (rest ? '?' + rest : ''));
}
