// 기기 목소리로 한 마디를 빠르게 읽어 줍니다. 소리 파일을 받아 두지 않아 앱이 무거워지지 않습니다.
// 앱이 켜져 있을 때만 납니다. 닫아 둔 앱에 오는 알림음은 OS 가 정하고 웹에서는 바꿀 수 없습니다.
// 목소리가 없거나 기기가 조용하면 소리가 나지 않으므로, 대신 낼 소리를 fallback 으로 받습니다.
export function say(word: string, fallback?: () => void, rate = 1.6) {
  try {
    const voice = window.speechSynthesis;
    if (!voice || typeof SpeechSynthesisUtterance === 'undefined') {
      fallback?.();
      return;
    }
    // 앞말이 남아 있을 때만 지웁니다. 아무 때나 cancel 하면 바로 뒤의 speak 가 통째로 묻히는 기기가 있습니다.
    if (voice.speaking || voice.pending) voice.cancel();
    const line = new SpeechSynthesisUtterance(word);
    // 영어 목소리로 읽어야 'pelham' 이 글자대로 나옵니다.
    line.lang = 'en-US';
    // 1 이 보통 속도입니다. 한 마디는 툭 끊어 내도록 빠르게, 여러 마디는 조금 눌러 또박또박 읽습니다.
    line.rate = rate;
    line.onerror = () => fallback?.();
    voice.speak(line);
  } catch {
    fallback?.();
  }
}
