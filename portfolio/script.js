/* Storage Keys */
const USERS_DB_KEY = 'portfolio_users_db';
const LOGS_DB_KEY = 'portfolio_audit_logs';
const SESSION_KEY = 'portfolio_active_session';
const PROJECTS_KEY = 'portfolio_projects_data';

const INITIAL_PROJECTS = [
  { id: '1', title: "Aura OS", category: "Spatial Interaction", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=700&q=80", pinned: true },
  { id: '2', title: "Hyperlight", category: "Generative Identity", img: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=700&q=80", pinned: true },
  { id: '3', title: "Vektor Form", category: "Parametric Architecture", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80", pinned: false },
  { id: '4', title: "Krypton Grid", category: "Editorial / WebGL", img: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80", pinned: false },
  { id: '5', title: "Mono Font", category: "Typography", img: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=700&q=80", pinned: false }
];

let currentUser = null;
let projects = [];
let isExpanded = false;

/* 1. Initialize State */
function initApp() {
  // Ensure storage registries exist
  if (!localStorage.getItem(USERS_DB_KEY)) localStorage.setItem(USERS_DB_KEY, JSON.stringify([]));
  if (!localStorage.getItem(LOGS_DB_KEY)) localStorage.setItem(LOGS_DB_KEY, JSON.stringify([]));

  // Load Session
  const activeSession = localStorage.getItem(SESSION_KEY);
  if (activeSession) {
    currentUser = JSON.parse(activeSession);
  }
  updateNavState();

  // Load Projects
  const localProjects = localStorage.getItem(PROJECTS_KEY);
  projects = localProjects ? JSON.parse(localProjects) : [...INITIAL_PROJECTS];

  // Intercept shared link parameters (?pinned=id1,id2)
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('pinned');
  if (shared) {
    const ids = shared.split(',');
    projects = projects.map(p => ({ ...p, pinned: ids.includes(String(p.id)) }));
  }

  renderGrid();
}

/* 2. Navigation State Engine */
function updateNavState() {
  const container = document.getElementById('navActions');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <span class="user-badge">Hello, <strong>${currentUser.firstName}</strong></span>
      <button class="btn-secondary" onclick="sharePinnedLink()">Share Curated Link</button>
      <button class="btn-primary" onclick="toggleModal('uploadModal', true)">+ Add Project</button>
      <button class="btn-secondary" onclick="handleLogout()">Log Out</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn-secondary" onclick="sharePinnedLink()">Share Curated Link</button>
      <button class="btn-secondary" onclick="toggleModal('loginModal', true)">Log In</button>
      <button class="btn-primary" onclick="toggleModal('signupModal', true)">Sign Up</button>
    `;
  }
}

/* 3. Authentication: Sign Up */
function handleSignup(e) {
  e.preventDefault();
  const firstName = document.getElementById('regFirstName').value.trim();
  const lastName = document.getElementById('regLastName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;

  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];

  // Check unique constraints
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    alert("Username is already taken. Choose another.");
    return;
  }
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    alert("Email address already registered. Please log in.");
    return;
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    firstName,
    lastName,
    username,
    email,
    password, // For full production, hash on server
    provider: 'local',
    status: 'active',
    registeredAt: new Date().toISOString(),
    loginCount: 0
  };

  users.push(newUser);
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));

  // Automatically log in and record initial activity log
  loginUser(newUser, 'Standard Registration');
  toggleModal('signupModal', false);
  document.getElementById('signupForm').reset();
}

/* 4. Authentication: Login */
function handleLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
  const user = users.find(u => 
    (u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier) && 
    u.password === password
  );

  if (!user) {
    alert("Invalid credentials. Verify your username/password and try again.");
    return;
  }

  if (user.status === 'suspended') {
    alert("This account has been suspended by the administrator.");
    return;
  }

  loginUser(user, 'Standard Form');
  toggleModal('loginModal', false);
  document.getElementById('loginForm').reset();
}

/* 5. Google Sign Up Simulation */
function handleGoogleAuth() {
  const dummyGoogleEmail = prompt("Simulate Google Account Email:", "creative@gmail.com");
  if (!dummyGoogleEmail) return;

  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
  let user = users.find(u => u.email.toLowerCase() === dummyGoogleEmail.toLowerCase());

  if (!user) {
    const nameParts = dummyGoogleEmail.split('@')[0].split('.');
    user = {
      id: 'usr_g_' + Date.now(),
      firstName: nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1),
      lastName: nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'GoogleUser',
      username: dummyGoogleEmail.split('@')[0],
      email: dummyGoogleEmail.toLowerCase(),
      password: null,
      provider: 'google',
      status: 'active',
      registeredAt: new Date().toISOString(),
      loginCount: 0
    };
    users.push(user);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  }

  loginUser(user, 'Google OAuth');
  toggleModal('signupModal', false);
}

/* 6. Universal Login & Audit Logger */
function loginUser(user, method) {
  // Update user stats
  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
  const idx = users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    users[idx].loginCount = (users[idx].loginCount || 0) + 1;
    users[idx].lastLoginAt = new Date().toISOString();
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  }

  // Register in centralized audit log
  const logs = JSON.parse(localStorage.getItem(LOGS_DB_KEY)) || [];
  const logEntry = {
    id: 'log_' + Date.now(),
    userId: user.id,
    fullName: `${user.firstName} ${user.lastName}`,
    username: user.username,
    email: user.email,
    authMethod: method,
    timestamp: new Date().toISOString()
  };
  logs.unshift(logEntry);
  localStorage.setItem(LOGS_DB_KEY, JSON.stringify(logs));

  // Save Active Session
  currentUser = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  updateNavState();
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  updateNavState();
}

/* 7. Modal Switching & Rendering */
function toggleModal(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('active', show);
}

function switchModals(fromId, toId) {
  toggleModal(fromId, false);
  toggleModal(toId, true);
}

/* 8. Portfolio Rendering & Pinning */
function renderGrid() {
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const sorted = [...projects].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const visible = isExpanded ? sorted : sorted.slice(0, 3);

  visible.forEach(p => {
    const card = document.createElement('article');
    card.className = `project-card ${p.pinned ? 'is-pinned' : ''}`;
    card.innerHTML = `
      <div class="media-box" style="background-image: url('${p.img}')">
        ${p.pinned ? '<span class="pin-badge">Pinned</span>' : ''}
      </div>
      <div class="project-meta">
        <div>
          <h3>${p.title}</h3>
          <span>${p.category}</span>
        </div>
        <div class="card-actions">
          <button class="icon-btn ${p.pinned ? 'pinned' : ''}" title="Pin to top (max 3)" onclick="togglePin('${p.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${p.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button class="icon-btn delete" title="Delete work" onclick="deleteProject('${p.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  const counter = document.getElementById('counter');
  if (counter) counter.innerText = `Showing ${visible.length} of ${projects.length} projects`;

  const wrap = document.getElementById('seeMoreWrap');
  if (wrap) wrap.style.display = projects.length <= 3 ? 'none' : 'flex';
  const seeMoreText = document.getElementById('seeMoreText');
  if (seeMoreText) seeMoreText.innerText = isExpanded ? 'Show Less' : 'Explore All Works';
}

function togglePin(id) {
  const target = projects.find(p => String(p.id) === String(id));
  if (!target) return;

  const activePins = projects.filter(p => p.pinned);
  if (!target.pinned && activePins.length >= 3) {
    alert("Limit reached: You can only pin up to 3 projects at once.");
    return;
  }

  target.pinned = !target.pinned;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  renderGrid();
}

function deleteProject(id) {
  if (confirm("Remove this project from showcase?")) {
    projects = projects.filter(p => String(p.id) !== String(id));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    renderGrid();
  }
}

function handleProjectSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('projTitle').value;
  const category = document.getElementById('projCategory').value;
  const file = document.getElementById('projImage').files[0];

  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const item = {
      id: Date.now().toString(),
      title,
      category,
      img: event.target.result,
      pinned: false
    };
    projects.unshift(item);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    toggleModal('uploadModal', false);
    document.getElementById('projectForm').reset();
    renderGrid();
  };
  reader.readAsDataURL(file);
}

function toggleSeeMore() {
  isExpanded = !isExpanded;
  renderGrid();
}

function sharePinnedLink() {
  const pinnedIds = projects.filter(p => p.pinned).map(p => p.id);
  if (!pinnedIds.length) {
    alert("Pin at least one project using the star icon before sharing!");
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('pinned', pinnedIds.join(','));
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert("Custom showcase link copied!\n\n" + url.toString());
  }).catch(() => {
    prompt("Copy this share link:", url.toString());
  });
}

/* 9. Hero Canvas Motion */
const canvas = document.getElementById('heroCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let width, height, t = 0;

  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function renderMotion() {
    ctx.fillStyle = '#0c0d0e';
    ctx.fillRect(0, 0, width, height);

    const lines = 16;
    for (let i = 0; i < lines; i++) {
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.03 + (i / lines) * 0.08})`;

      for (let x = 0; x < width; x += 15) {
        const y = (height / 2) +
          Math.sin(x * 0.003 + t + i * 0.2) * 55 * Math.sin(t * 0.3) +
          Math.cos(x * 0.005 + t * 0.5) * 25;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    t += 0.015;
    requestAnimationFrame(renderMotion);
  }
  renderMotion();
}

window.addEventListener('DOMContentLoaded', initApp);