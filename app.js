import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBgKouORb-ETyl8Feo6DtU7QUuLHogOUvE',
  authDomain: 'nurselife-af35c.firebaseapp.com',
  projectId: 'nurselife-af35c',
  appId: '1:895294364606:web:fc798486716ebc25bc77ef',
  messagingSenderId: '895294364606',
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const elements = Object.fromEntries(['login-view', 'admin-view', 'google-login-button', 'login-error', 'logout-button', 'track-form', 'publish-button', 'publish-status', 'artwork', 'audio', 'artwork-name', 'audio-name', 'track-count', 'catalog-list', 'catalog-empty', 'catalog-search'].map((id) => [id.replaceAll('-', '_'), document.getElementById(id)]));
let tracks = [];
let unsubscribeCatalog = () => {};
const githubTokenInput = document.getElementById('github-token');
const rememberTokenInput = document.getElementById('remember-token');
const forgetTokenButton = document.getElementById('forget-token');
const tokenStorageKey = 'nurselife-github-token';
githubTokenInput.value = localStorage.getItem(tokenStorageKey) || sessionStorage.getItem(tokenStorageKey) || '';
rememberTokenInput.checked = Boolean(localStorage.getItem(tokenStorageKey));
function saveToken() { sessionStorage.setItem(tokenStorageKey, githubTokenInput.value); if (rememberTokenInput.checked) localStorage.setItem(tokenStorageKey, githubTokenInput.value); else localStorage.removeItem(tokenStorageKey); }
githubTokenInput.addEventListener('input', saveToken);
rememberTokenInput.addEventListener('change', saveToken);
forgetTokenButton.addEventListener('click', () => { localStorage.removeItem(tokenStorageKey); sessionStorage.removeItem(tokenStorageKey); githubTokenInput.value = ''; rememberTokenInput.checked = false; });

elements.google_login_button.addEventListener('click', async () => {
  setNotice(elements.login_error, '');
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { setNotice(elements.login_error, error?.code === 'auth/unauthorized-domain' ? 'Falta autorizar danielerickem.github.io en Firebase Authentication.' : 'No se pudo iniciar sesión con Google.', true); }
});
elements.logout_button.addEventListener('click', () => signOut(auth));
elements.artwork.addEventListener('change', () => { elements.artwork_name.textContent = elements.artwork.files[0]?.name || 'Elegir imagen'; });
elements.audio.addEventListener('change', () => { elements.audio_name.textContent = elements.audio.files[0]?.name || 'Elegir audio'; });
elements.catalog_search.addEventListener('input', renderCatalog);

onAuthStateChanged(auth, async (user) => {
  unsubscribeCatalog();
  if (!user) return showLogin();
  const admin = await getDoc(doc(db, 'adminUsers', user.uid));
  if (!admin.exists()) { await signOut(auth); setNotice(elements.login_error, 'Esta cuenta no tiene permiso para administrar el catálogo.', true); return; }
  showAdmin();
  unsubscribeCatalog = onSnapshot(query(collection(db, 'catalogTracks'), orderBy('createdAt', 'desc')), (snapshot) => { tracks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); renderCatalog(); });
});

elements.track_form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const artwork = elements.artwork.files[0]; const audio = elements.audio.files[0];
  const token = document.getElementById('github-token').value.trim(); const owner = document.getElementById('github-owner').value.trim(); const repo = document.getElementById('github-repo').value.trim();
  if (!artwork || !audio || !token || !owner || !repo) return setNotice(elements.publish_status, 'Completa los archivos y la conexión de GitHub.', true);
  if (artwork.size > 25 * 1024 * 1024 || audio.size > 90 * 1024 * 1024) return setNotice(elements.publish_status, 'La portada debe pesar menos de 25 MB y el MP3 menos de 90 MB.', true);
  setPublishing(true, 'Subiendo portada a GitHub...');
  try {
    const stamp = Date.now(); const artworkPath = `artwork/${stamp}-${safeName(artwork.name)}`; const audioPath = `audio/${stamp}-${safeName(audio.name)}`;
    const artworkUrl = await uploadFile({ owner, repo, token, path: artworkPath, file: artwork, message: `Add artwork: ${document.getElementById('title').value.trim()}` });
    setNotice(elements.publish_status, 'Subiendo MP3 a GitHub...');
    const audioUrl = await uploadFile({ owner, repo, token, path: audioPath, file: audio, message: `Add audio: ${document.getElementById('title').value.trim()}` });
    setNotice(elements.publish_status, 'Publicando en Firestore...');
    await addDoc(collection(db, 'catalogTracks'), { title: document.getElementById('title').value.trim(), artist: document.getElementById('artist').value.trim(), album: document.getElementById('album').value.trim() || null, artwork: artworkUrl, audioUrl, duration: parseDuration(document.getElementById('duration').value), lyrics: document.getElementById('lyrics').value.trim() || null, createdAt: serverTimestamp() });
    elements.track_form.reset(); githubTokenInput.value = localStorage.getItem(tokenStorageKey) || sessionStorage.getItem(tokenStorageKey) || ''; rememberTokenInput.checked = Boolean(localStorage.getItem(tokenStorageKey)); document.getElementById('github-owner').value = 'DanielErickEM'; document.getElementById('github-repo').value = 'nurselife-music'; elements.artwork_name.textContent = 'Elegir imagen'; elements.audio_name.textContent = 'Elegir audio'; setNotice(elements.publish_status, 'Canción publicada. Ya está disponible en NurseLife Music.');
  } catch (error) { setNotice(elements.publish_status, error instanceof Error ? error.message : 'No se pudo publicar la canción.', true); } finally { setPublishing(false); }
});

async function uploadFile({ owner, repo, token, path, file, message }) {
  const content = arrayBufferToBase64(await file.arrayBuffer());
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }, body: JSON.stringify({ message, content }) });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || 'GitHub rechazó la subida. Revisa el token y el repositorio.'); }
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path.split('/').map(encodeURIComponent).join('/')}`;
}
function arrayBufferToBase64(buffer) { let binary = ''; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte); return btoa(binary); }
function safeName(name) { return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]+/g, '-'); }
function parseDuration(value) { const parts = value.trim().split(':').map(Number); if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1]; const seconds = Number(value); return Number.isFinite(seconds) && seconds > 0 ? seconds : 0; }
function showLogin() { elements.login_view.hidden = false; elements.admin_view.hidden = true; elements.logout_button.hidden = true; }
function showAdmin() { elements.login_view.hidden = true; elements.admin_view.hidden = false; elements.logout_button.hidden = false; }
function setNotice(element, message, isError = false) { element.textContent = message; element.hidden = !message; element.classList.toggle('error', isError); }
function setPublishing(publishing, message = '') { elements.publish_button.disabled = publishing; elements.publish_button.textContent = publishing ? 'Publicando...' : 'Subir y publicar canción'; if (message) setNotice(elements.publish_status, message); }
function renderCatalog() { const term = elements.catalog_search.value.trim().toLowerCase(); const visible = tracks.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(term)); elements.track_count.textContent = tracks.length; elements.catalog_empty.hidden = visible.length > 0; elements.catalog_list.innerHTML = visible.map((track) => `<article class="track"><img src="${escapeAttribute(track.artwork)}" alt=""><div><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ''}</span></div><button class="delete" data-id="${track.id}">Eliminar</button></article>`).join(''); document.querySelectorAll('.delete').forEach((button) => button.addEventListener('click', () => removeTrack(button.dataset.id))); }
async function removeTrack(id) { if (!confirm('¿Eliminar esta canción del catálogo? Los archivos seguirán en GitHub.')) return; await deleteDoc(doc(db, 'catalogTracks', id)); }
function escapeHtml(value = '') { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function escapeAttribute(value = '') { return escapeHtml(value).replaceAll('"', '&quot;'); }
