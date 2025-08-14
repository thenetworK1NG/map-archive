import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Archive Firebase project (job-card-storage)
const firebaseConfig = {
  apiKey: "AIzaSyDDgGumUKnq_zB9sAcCoMzQdWd8h3RgmCY",
  authDomain: "job-card-storage.firebaseapp.com",
  databaseURL: "https://job-card-storage-default-rtdb.firebaseio.com",
  projectId: "job-card-storage",
  storageBucket: "job-card-storage.firebasestorage.app",
  messagingSenderId: "276127361660",
  appId: "1:276127361660:web:7e2b0f9dbb27c68bb1b7f9",
  measurementId: "G-1JJZ0XFPLQ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const statusEl = document.getElementById('status');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const archiveListEl = document.getElementById('archiveList');

// Modal elements
const jobModal = document.getElementById('jobModal');
const closeJobModal = document.getElementById('closeJobModal');
const jobModalTitle = document.getElementById('jobModalTitle');
const jobModalBody = document.getElementById('jobModalBody');

let archives = [];

function formatDateTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return '—'; }
}

function safe(v) { return (v ?? '') === '' ? '—' : v; }

function money(n) {
  const x = Number(n);
  if (!isFinite(x)) return '—';
  return 'R ' + x.toFixed(2);
}

function renderList() {
  archiveListEl.innerHTML = '';
  const filtered = filterList(searchInput.value || '');
  statusEl.textContent = filtered.length ? `${filtered.length} archived jobs` : 'No archived jobs.';

  filtered
    .sort((a,b) => (b.archivedAt||0) - (a.archivedAt||0))
    .forEach(j => {
      const item = document.createElement('button');
      item.className = 'client-item';
      item.type = 'button';
      item.innerHTML = `
        <div class="client-title">
          <span>${safe(j.customerName)}</span>
          <span class="amount">${j.jobTotal ? money(j.jobTotal) : ''}</span>
        </div>
        <div class="client-sub">
          <span class="muted">${safe(j.date)}</span>
          <span class="badge">Done: ${safe(j.doneBy) || '—'}</span>
          <span class="badge">Archived: ${formatDateTime(j.archivedAt)}</span>
        </div>
        <div class="muted">${safe((j.jobDescription||'').slice(0,80))}${(j.jobDescription||'').length>80?'...':''}</div>
      `;
      item.addEventListener('click', () => openJobModal(j));
      archiveListEl.appendChild(item);
    });
}

function filterList(q) {
  const s = q.trim().toLowerCase();
  if (!s) return archives;
  return archives.filter(j => [
    j.customerName, j.customerCell, j.email, j.assignedTo, j.doneBy,
    j.jobDescription
  ].some(v => (v||'').toLowerCase().includes(s)));
}

function toCsv(rows) {
  const header = ['Customer','Date','Phone','Assigned To','Done By','Done At','Archived At','Total','Description'];
  const lines = rows.map(j => [
    j.customerName || '', j.date || '', j.customerCell || '', j.assignedTo || '', j.doneBy || '',
    j.doneAt || '', j.archivedAt || '', j.jobTotal || '', (j.jobDescription || '').replace(/\n/g,' ')
  ]);
  const all = [header, ...lines];
  return all.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\r\n');
}

async function loadArchives() {
  statusEl.textContent = 'Loading...';
  try {
    const snap = await get(ref(db, 'archivedJobs'));
    archives = snap.exists() ? Object.values(snap.val()) : [];
    renderList();
  } catch (e) {
    console.error('Failed to load archives', e);
    statusEl.textContent = 'Error loading archives: ' + (e.message || e);
  }
}

// ----- Modal rendering -----
function openJobModal(j) {
  jobModalTitle.textContent = safe(j.customerName) + ' — ' + (safe(j.date));
  const kb = j.kanboardSummary || null;
  jobModalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <h4>Customer</h4>
        <p>${safe(j.customerName)}</p>
        <p class="muted">${safe(j.customerCell)}${j.email ? ' • ' + j.email : ''}</p>
      </div>
      <div class="detail-card">
        <h4>Job</h4>
        <p>${safe(j.jobDescription)}</p>
        <p class="muted">Total: ${j.jobTotal ? money(j.jobTotal) : '—'}</p>
      </div>
      <div class="detail-card">
        <h4>Status</h4>
        <p>Assigned: ${safe(j.assignedTo)}</p>
        <p>Done by: ${safe(j.doneBy)}</p>
        <p class="muted">Done at: ${formatDateTime(j.doneAt)}</p>
      </div>
      <div class="detail-card">
        <h4>Archive</h4>
        <p>Archived at: ${formatDateTime(j.archivedAt)}</p>
        <p class="muted">Key: ${safe(j._originalKey)}</p>
      </div>
      ${kb ? `
      <div class="detail-card">
        <h4>Kanboard</h4>
        <p>Project: ${safe(kb.project_id)} | Task: ${safe(kb.task_id)}</p>
        <p>Column: ${safe(kb.column_name)} (${safe(kb.column_id)})</p>
        <p class="muted">Swimlane: ${safe(kb.swimlane_id)} • Position: ${safe(kb.position)}</p>
        <p class="muted">Moved: ${formatDateTime(kb.date_moved)}</p>
      </div>
      ` : ''}
    </div>
  `;
  jobModal.style.display = 'flex';
}

function closeModal() { jobModal.style.display = 'none'; }

// Events
refreshBtn.addEventListener('click', () => loadArchives());
searchInput.addEventListener('input', () => renderList());
exportCsvBtn.addEventListener('click', () => {
  const list = filterList(searchInput.value || '');
  const csv = toCsv(list);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'archived_jobs.csv'; a.click(); URL.revokeObjectURL(url);
});
closeJobModal.addEventListener('click', closeModal);
jobModal.addEventListener('click', (e) => { if (e.target === jobModal) closeModal(); });

// Initial load
loadArchives();
