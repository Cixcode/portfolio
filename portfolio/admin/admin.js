const USERS_DB_KEY = 'portfolio_users_db';
const LOGS_DB_KEY = 'portfolio_audit_logs';

let allUsers = [];

function initAdminDashboard() {
  renderUsersTable();
  renderLogsTable();
}

/* 1. Render Users with Full Personal Details */
function renderUsersTable(filteredList = null) {
  allUsers = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
  const listToDisplay = filteredList || allUsers;
  const tbody = document.getElementById('userTableBody');
  document.getElementById('userCount').innerText = `${allUsers.length} Users Registered`;

  if (!listToDisplay.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--muted);">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = listToDisplay.map(user => {
    const initials = `${user.firstName ? user.firstName[0] : ''}${user.lastName ? user.lastName[0] : ''}` || 'U';
    const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never';

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar-initials">${initials}</div>
            <div>
              <strong>${user.firstName} ${user.lastName}</strong>
              <div style="font-size:0.75rem; color: var(--muted); font-family: monospace;">${user.id}</div>
            </div>
          </div>
        </td>
        <td><code>@${user.username}</code></td>
        <td>${user.email}</td>
        <td><span class="badge ${user.provider}">${user.provider.toUpperCase()}</span></td>
        <td style="font-size: 0.8rem; color: var(--muted);">${new Date(user.registeredAt).toLocaleDateString()}</td>
        <td><strong>${user.loginCount || 0}</strong></td>
        <td style="font-size: 0.8rem;">${lastLogin}</td>
        <td><span class="badge ${user.status}">${user.status.toUpperCase()}</span></td>
        <td>
          <button class="action inspect" onclick="inspectUser('${user.id}')" title="View Full Details">Inspect</button>
          <button class="action" onclick="toggleUserStatus('${user.id}')">${user.status === 'active' ? 'Suspend' : 'Activate'}</button>
          <button class="action delete" onclick="deleteUser('${user.id}')" title="Remove User">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

/* 2. Search / Filter Users in Real-Time */
function filterUsers() {
  const query = document.getElementById('userSearchInput').value.toLowerCase().trim();
  if (!query) {
    renderUsersTable();
    return;
  }

  const filtered = allUsers.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
    u.email.toLowerCase().includes(query) ||
    u.username.toLowerCase().includes(query)
  );

  renderUsersTable(filtered);
}

/* 3. Detailed Profile Dossier Modal */
function inspectUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <div class="profile-item">
      <label>First Name</label>
      <span>${user.firstName || 'N/A'}</span>
    </div>
    <div class="profile-item">
      <label>Last Name</label>
      <span>${user.lastName || 'N/A'}</span>
    </div>
    <div class="profile-item">
      <label>Username</label>
      <span>@${user.username}</span>
    </div>
    <div class="profile-item">
      <label>Email Address</label>
      <span>${user.email}</span>
    </div>
    <div class="profile-item">
      <label>Account ID</label>
      <span style="font-family: monospace; font-size:0.75rem;">${user.id}</span>
    </div>
    <div class="profile-item">
      <label>Sign Up Provider</label>
      <span class="badge ${user.provider}">${user.provider.toUpperCase()}</span>
    </div>
    <div class="profile-item">
      <label>Account Status</label>
      <span class="badge ${user.status}">${user.status.toUpperCase()}</span>
    </div>
    <div class="profile-item">
      <label>Lifetime Logins</label>
      <span>${user.loginCount || 0} Successful Sessions</span>
    </div>
    <div class="profile-item full-row">
      <label>Registered Date & Time</label>
      <span>${new Date(user.registeredAt).toLocaleString()}</span>
    </div>
    <div class="profile-item full-row">
      <label>Last Active Timestamp</label>
      <span>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'No active sessions recorded yet'}</span>
    </div>
  `;

  toggleModal(true);
}

function toggleModal(show) {
  const modal = document.getElementById('profileModal');
  modal.classList.toggle('active', show);
}

/* 4. Render Login Audit Trail with Timestamps */
function renderLogsTable() {
  const logs = JSON.parse(localStorage.getItem(LOGS_DB_KEY)) || [];
  const tbody = document.getElementById('logTableBody');
  document.getElementById('logCount').innerText = `${logs.length} Total Sessions`;

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--muted);">No login sessions logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td><code>${l.id.slice(-6)}</code></td>
      <td><strong>${l.fullName}</strong> <span style="color:var(--muted); font-size:0.75rem;">(@${l.username})</span></td>
      <td>${l.email}</td>
      <td><span class="badge ${l.authMethod.includes('Google') ? 'google' : 'local'}">${l.authMethod}</span></td>
      <td style="color:#60a5fa;">${new Date(l.timestamp).toLocaleString()}</td>
      <td style="color:var(--muted); font-size:0.75rem;">${formatRelative(l.timestamp)}</td>
    </tr>
  `).join('');
}

/* 5. User Control Operations */
function toggleUserStatus(userId) {
  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
  const target = users.find(u => u.id === userId);
  if (!target) return;

  target.status = target.status === 'active' ? 'suspended' : 'active';
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  renderUsersTable();
}

function deleteUser(userId) {
  if (confirm("Are you sure you want to permanently delete this user account?")) {
    let users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    renderUsersTable();
  }
}

function clearLogs() {
  if (confirm("Flush all login audit trail history?")) {
    localStorage.setItem(LOGS_DB_KEY, JSON.stringify([]));
    renderLogsTable();
  }
}

function formatRelative(isoStr) {
  const diff = Math.floor((new Date() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

window.addEventListener('DOMContentLoaded', initAdminDashboard);