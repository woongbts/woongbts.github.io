import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID_KEY = 'woongbi.crm.microsoftClientId';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Files.Read'];
const SALES_FOLDER = ['웅비통신', '웅비통신 판매일보'];
const AUTH_REDIRECT_PATH = '/auth-redirect.html';
let msalInstance = null;
let msalClientId = '';
let interactiveRequestPromise = null;

export function getStoredOneDriveClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || '';
}

export function setStoredOneDriveClientId(value) {
  const clientId = String(value || '').trim();
  if (clientId && !/^[0-9a-f-]{36}$/i.test(clientId)) throw new Error('Microsoft Client ID 형식을 확인해 주세요.');
  if (clientId) localStorage.setItem(CLIENT_ID_KEY, clientId);
  else localStorage.removeItem(CLIENT_ID_KEY);
  msalInstance = null;
  msalClientId = '';
  interactiveRequestPromise = null;
  return clientId;
}

function redirectUri() {
  return `${location.origin}${AUTH_REDIRECT_PATH}`;
}

function appUri() {
  return `${location.origin}/`;
}

function showOneDriveProgress(message) {
  const label = document.getElementById('od-status');
  if (!label) return;
  label.textContent = message;
  label.className = 'connection-state pending';
}

function showOneDriveConnected(message = '연결됨 · Microsoft 계정') {
  const label = document.getElementById('od-status');
  if (!label) return;
  label.textContent = message;
  label.className = 'connection-state connected';
}

async function getMsal() {
  const clientId = getStoredOneDriveClientId();
  if (!clientId) throw new Error('Microsoft Client ID를 먼저 저장해 주세요.');
  if (msalInstance && msalClientId === clientId) return msalInstance;

  const instance = new PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/consumers',
      redirectUri: redirectUri(),
      postLogoutRedirectUri: appUri()
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    }
  });
  await instance.initialize();
  const accounts = instance.getAllAccounts();
  if (accounts.length) instance.setActiveAccount(accounts[0]);
  msalInstance = instance;
  msalClientId = clientId;
  return instance;
}

async function runInteractive(operation) {
  if (interactiveRequestPromise) return interactiveRequestPromise;
  interactiveRequestPromise = Promise.resolve()
    .then(operation)
    .finally(() => { interactiveRequestPromise = null; });
  return interactiveRequestPromise;
}

export async function getOneDriveStatus() {
  const clientId = getStoredOneDriveClientId();
  if (!clientId) return { configured: false, connected: false, account: '' };
  try {
    const instance = await getMsal();
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
    return { configured: true, connected: Boolean(account), account: account?.username || account?.name || '' };
  } catch {
    return { configured: true, connected: false, account: '' };
  }
}

export async function connectOneDrive() {
  const instance = await getMsal();
  return runInteractive(async () => {
    const existing = instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
    if (existing) return { account: existing.username || existing.name || 'Microsoft 계정' };
    const result = await instance.loginPopup({
      scopes: SCOPES,
      prompt: 'select_account',
      redirectUri: redirectUri()
    });
    if (!result?.account) throw new Error('Microsoft 계정 연결을 완료하지 못했습니다.');
    instance.setActiveAccount(result.account);
    return { account: result.account.username || result.account.name || 'Microsoft 계정' };
  });
}

export async function disconnectOneDrive() {
  const instance = await getMsal();
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
  if (!account) return;
  await runInteractive(() => instance.logoutPopup({ account, postLogoutRedirectUri: appUri() }));
}

async function accessToken() {
  const instance = await getMsal();
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
  if (!account) throw new Error('Microsoft 계정 연결을 먼저 완료해 주세요.');

  try {
    const result = await instance.acquireTokenSilent({
      scopes: SCOPES,
      account,
      redirectUri: redirectUri()
    });
    return result.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) throw error;
    showOneDriveProgress('Microsoft 파일 읽기 권한 확인 중...');
    return runInteractive(async () => {
      const result = await instance.acquireTokenPopup({
        scopes: SCOPES,
        account,
        redirectUri: redirectUri()
      });
      return result.accessToken;
    });
  }
}

async function graphFetch(pathOrUrl, { blob = false } = {}) {
  const token = await accessToken();
  const url = /^https:\/\//i.test(pathOrUrl) ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
  const controller = new AbortController();
  const timeoutMs = blob ? 120000 : 30000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch {}
      throw new Error(detail || `OneDrive 요청 실패 (${response.status})`);
    }
    return blob ? response.blob() : response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(blob
        ? 'OneDrive 판매일보 내려받기 응답이 2분 이상 없어 중단했습니다.'
        : 'OneDrive 응답이 30초 이상 없어 중단했습니다. Microsoft 계정 연결 상태를 확인해 주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function listChildren(itemId) {
  const items = [];
  let url = `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(itemId)}/children?$top=200&$select=id,name,lastModifiedDateTime,size,file,folder`;
  while (url) {
    const data = await graphFetch(url);
    items.push(...(data.value || []));
    url = data['@odata.nextLink'] || '';
  }
  return items;
}

export async function discoverOneDriveSalesFiles(onProgress = () => {}) {
  const report = message => {
    onProgress(message);
    showOneDriveProgress(message);
  };

  report('OneDrive 판매일보 폴더 확인 중...');
  const encodedPath = SALES_FOLDER.map(encodeURIComponent).join('/');
  const root = await graphFetch(`/me/drive/root:/${encodedPath}`);
  if (!root?.id) throw new Error('OneDrive에서 “웅비통신/웅비통신 판매일보” 폴더를 찾지 못했습니다.');

  const files = [];
  let visitedFolders = 0;
  async function walk(folderId, relativePath = '', depth = 0) {
    if (depth > 5) return;
    visitedFolders++;
    report(`OneDrive 폴더 확인 중 · ${visitedFolders}개 폴더`);
    const children = await listChildren(folderId);
    for (const item of children) {
      const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;
      if (item.folder) {
        await walk(item.id, itemPath, depth + 1);
      } else if (item.file && /\.(xlsx|xls|csv)$/i.test(item.name || '')) {
        files.push({
          id: item.id,
          name: item.name,
          relativePath: itemPath,
          size: Number(item.size || 0),
          lastModified: Date.parse(item.lastModifiedDateTime || '') || 0,
          lastModifiedDateTime: item.lastModifiedDateTime || ''
        });
      }
    }
  }

  await walk(root.id);
  report(`OneDrive 파일 목록 확인 완료 · ${files.length}개 Excel/CSV`);
  return files;
}

export async function downloadOneDriveFiles(entries, onProgress = () => {}) {
  const files = [];
  const total = entries.length;
  for (let i = 0; i < total; i++) {
    const entry = entries[i];
    const message = `OneDrive 판매일보 내려받는 중 ${i + 1}/${total} · ${entry.name}`;
    onProgress(message);
    showOneDriveProgress(`판매일보 내려받는 중 ${i + 1}/${total}`);
    const blob = await graphFetch(`/me/drive/items/${encodeURIComponent(entry.id)}/content`, { blob: true });
    files.push(new File([blob], entry.name, {
      type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: entry.lastModified || Date.now()
    }));
  }
  showOneDriveConnected('연결됨 · 판매일보 다운로드 완료');
  return files;
}
