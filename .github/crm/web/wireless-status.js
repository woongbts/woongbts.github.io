const runsUrl = 'https://api.github.com/repos/woongbts/woongbts.github.io/actions/workflows/daily-wireless-sync.yml/runs?branch=main&per_page=30';
const formatDate = value => new Date(value).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'});

export function describeWireless(runs, notice, now = Date.now()) {
  const latest = runs?.[0];
  if (!latest) return '갱신 실행 기록을 확인할 수 없습니다.';
  const success = runs.find(run => run.conclusion === 'success');
  let text = latest.status !== 'completed' ? '자료 갱신 대기 또는 실행 중'
    : latest.conclusion === 'success' ? '최근 자료 갱신 성공' : '최근 자료 갱신 미완료 · 실행 기록 확인 필요';
  if (success) {
    text += ` · 마지막 성공 ${formatDate(success.updated_at)}`;
    if (now - Date.parse(success.updated_at) > 48 * 3600000) text += ' · 주의: 성공한 지 48시간이 지났습니다';
    if (String(notice?.refresh_run_id) === String(success.id) && Number.isSafeInteger(notice.refresh_change_count)) {
      text += notice.refresh_change_count === 0 ? ' · 대표 요금제 지원금 변동 없음' : ` · 대표 요금제 지원금 변동 ${notice.refresh_change_count}건`;
    } else text += ' · 해당 실행의 지원금 변동 건수는 확인 전입니다';
  } else text += ' · 최근 30회 내 성공 기록 없음';
  return text;
}

let loading = false;
export async function loadWirelessStatus() {
  const target = document.getElementById('wireless-refresh-status');
  if (!target || loading) return;
  loading = true;
  target.textContent = '공개 갱신 실행 기록을 확인하는 중입니다.';
  const options = {credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(10000)};
  try {
    const [runs, notice] = await Promise.all([
      fetch(runsUrl, options).then(r => { if (!r.ok) throw Error('unavailable'); return r.json(); }),
      fetch('https://woongbts.github.io/data/support-notice.json', options).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    target.textContent = describeWireless(runs.workflow_runs, notice);
  } catch {
    target.textContent = '갱신 상태를 불러오지 못했습니다. 조회 제한 또는 통신 문제일 수 있습니다. 실행 기록에서 확인해 주세요.';
  } finally { loading = false; }
}
