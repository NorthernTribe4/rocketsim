// ══════════════════════════════════════
// FIREBASE INIT
// ══════════════════════════════════════
import { initializeApp }                              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut,
         GoogleAuthProvider, signInWithPopup,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         updateProfile }                              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc,
         collection, addDoc, getDocs,
         deleteDoc, orderBy, query, limit }           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBakuyUJ9GSzjfun1h2CtVq6oZXELr2xos",
  authDomain:        "rocketsim-9f4ec.firebaseapp.com",
  projectId:         "rocketsim-9f4ec",
  storageBucket:     "rocketsim-9f4ec.firebasestorage.app",
  messagingSenderId: "538379812916",
  appId:             "1:538379812916:web:23c2a20d156cd827454a61"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
export const getCurrentUser = () => currentUser;

// ══════════════════════════════════════
// AUTH MODAL
// ══════════════════════════════════════
function injectAuthModal() {
  if (document.getElementById('authModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="auth-modal-overlay" id="authModal">
      <div class="auth-modal">
        <button class="auth-close" onclick="closeAuthModal()">✕</button>
        <h2>🚀 RocketSim</h2>
        <p>Sign in to save simulations, designs, and AI chats.</p>
        <div class="auth-tabs">
          <button class="auth-tab active" onclick="switchAuthTab('signin')">Sign In</button>
          <button class="auth-tab" onclick="switchAuthTab('signup')">Create Account</button>
        </div>
        <div id="auth-signin-form" class="auth-form">
          <button class="google-btn" onclick="signInWithGoogle()">
            <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>
          <div class="auth-divider"><span>or</span></div>
          <input type="email"    id="signin-email"    placeholder="Email address">
          <input type="password" id="signin-password" placeholder="Password">
          <div class="auth-error" id="signin-error"></div>
          <button class="auth-submit-btn" onclick="signInWithEmail()">Sign In</button>
        </div>
        <div id="auth-signup-form" class="auth-form" style="display:none;">
          <button class="google-btn" onclick="signInWithGoogle()">
            <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>
          <div class="auth-divider"><span>or</span></div>
          <input type="text"     id="signup-name"     placeholder="Your name">
          <input type="email"    id="signup-email"    placeholder="Email address">
          <input type="password" id="signup-password" placeholder="Password (min 6 characters)">
          <div class="auth-error" id="signup-error"></div>
          <button class="auth-submit-btn" onclick="signUpWithEmail()">Create Account</button>
        </div>
      </div>
    </div>
  `);
  window.closeAuthModal   = () => document.getElementById('authModal').classList.remove('open');
  window.switchAuthTab    = switchAuthTab;
  window.signInWithGoogle = signInWithGoogle;
  window.signInWithEmail  = signInWithEmail;
  window.signUpWithEmail  = signUpWithEmail;
  window.signOutUser      = signOutUser;
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((btn,i)=>btn.classList.toggle('active',(i===0&&tab==='signin')||(i===1&&tab==='signup')));
  document.getElementById('auth-signin-form').style.display=tab==='signin'?'flex':'none';
  document.getElementById('auth-signup-form').style.display=tab==='signup'?'flex':'none';
}

// ══════════════════════════════════════
// AUTH METHODS
// ══════════════════════════════════════
async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    document.getElementById('authModal').classList.remove('open');
  } catch(e) {
    document.getElementById('signin-error').textContent = e.message;
  }
}

async function signInWithEmail() {
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl    = document.getElementById('signin-error');
  if (!email||!password) { errEl.textContent='Please enter your email and password.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('authModal').classList.remove('open');
  } catch(e) {
    errEl.textContent = e.code==='auth/invalid-credential' ? 'Incorrect email or password.' : e.message;
  }
}

async function signUpWithEmail() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');
  if (!name)               { errEl.textContent='Please enter your name.'; return; }
  if (!email)              { errEl.textContent='Please enter your email.'; return; }
  if (password.length < 6) { errEl.textContent='Password must be at least 6 characters.'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db,'users',cred.user.uid), { name, email, joinedAt: new Date().toISOString() });
    document.getElementById('authModal').classList.remove('open');
  } catch(e) {
    errEl.textContent = e.code==='auth/email-already-in-use' ? 'An account with this email already exists.' : e.message;
  }
}

async function signOutUser() {
  await signOut(auth);
  window.location.href = 'index.html';
}

// ══════════════════════════════════════
// NAV AUTH
// ══════════════════════════════════════
export function initAuthNav() {
  injectAuthModal();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const area = document.getElementById('nav-auth-area');
    if (!area) return;
    if (user) {
      const initial = (user.displayName||user.email||'?')[0].toUpperCase();
      const avatar  = user.photoURL ? `<img src="${user.photoURL}" alt="avatar">` : initial;
      area.innerHTML = `
        <a href="profile.html" class="nav-profile-btn">
          <div class="nav-avatar">${avatar}</div>
          <span>${user.displayName||user.email.split('@')[0]}</span>
        </a>
        <button class="nav-signout-btn" onclick="signOutUser()">Sign Out</button>`;
    } else {
      area.innerHTML = `<button class="nav-signin-btn" onclick="document.getElementById('authModal').classList.add('open')">Sign In</button>`;
    }
  });
}

// ══════════════════════════════════════
// FIRESTORE
// ══════════════════════════════════════
export async function saveSimHistory(uid, flightData) {
  try {
    await addDoc(collection(db,'users',uid,'simulations'), { ...flightData, savedAt: new Date().toISOString() });
  } catch(e) { console.error('Could not save simulation:', e); }
}

export async function saveUserDesign(uid, design) {
  await addDoc(collection(db,'users',uid,'designs'), design);
}

export async function saveAIChat(uid, chatData) {
  try {
    await addDoc(collection(db,'users',uid,'chats'), chatData);
  } catch(e) { console.error('Could not save chat:', e); }
}

// ══════════════════════════════════════
// PROFILE
// ══════════════════════════════════════
export function loadProfile() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href='index.html'; return; }
    currentUser = user;

    const initial  = (user.displayName||user.email||'?')[0].toUpperCase();
    const avatarEl = document.getElementById('profile-avatar');
    if (user.photoURL) avatarEl.innerHTML=`<img src="${user.photoURL}" alt="avatar">`;
    else avatarEl.textContent=initial;

    document.getElementById('profile-name').textContent   = user.displayName||'User';
    document.getElementById('profile-email').textContent  = user.email;
    document.getElementById('profile-joined').textContent =
      `Joined ${new Date(user.metadata.creationTime).toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}`;

    const [sims,designs,chats] = await Promise.all([
      getDocs(query(collection(db,'users',user.uid,'simulations'),orderBy('savedAt','desc'))),
      getDocs(query(collection(db,'users',user.uid,'designs'),    orderBy('savedAt','desc'))),
      getDocs(query(collection(db,'users',user.uid,'chats'),      orderBy('savedAt','desc'),limit(20)))
    ]);

    const simDocs    = sims.docs.map(d=>({id:d.id,...d.data()}));
    const designDocs = designs.docs.map(d=>({id:d.id,...d.data()}));
    const chatDocs   = chats.docs.map(d=>({id:d.id,...d.data()}));

    document.getElementById('stat-sims').textContent    = simDocs.length;
    document.getElementById('stat-designs').textContent = designDocs.length;

    if (simDocs.length) {
      const bestAlt   = Math.max(...simDocs.map(s=>parseFloat(s.maxAlt)||0));
      const motorRank = ['1/4A','1/2A','A','B','C','D','E','F','G','H+'];
      const bestMotor = simDocs.reduce((best,s)=>{
        const ri=motorRank.indexOf(s.motorClass), bi=motorRank.indexOf(best);
        return ri>bi?s.motorClass:best;
      },'1/4A');
      document.getElementById('stat-best-alt').textContent   = bestAlt.toFixed(0)+' m';
      document.getElementById('stat-best-motor').textContent = bestMotor;
    }

    // History
    const histEl=document.getElementById('history-list');
    histEl.innerHTML = !simDocs.length
      ? '<p style="color:var(--muted);font-size:13px;">No simulations yet.</p>'
      : simDocs.map(s=>`
        <div class="history-card">
          <div class="history-card-header">
            <span class="history-card-title">Motor ${s.motorClass} · ${s.maxAlt} m altitude</span>
            <span class="history-card-date">${new Date(s.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
          </div>
          <div class="history-card-stats">
            <span class="history-stat">Alt: <strong>${s.maxAlt} m</strong></span>
            <span class="history-stat">Vel: <strong>${s.maxVel} m/s</strong></span>
            <span class="history-stat">TWR: <strong>${s.twr}</strong></span>
            <span class="history-stat">Flight: <strong>${s.totalTime} s</strong></span>
            <span class="history-stat">Motor: <strong>${s.motorClass}</strong></span>
            ${s.stability?`<span class="history-stat">Stability: <strong>${s.stability.cls}</strong></span>`:''}
          </div>
          <div class="history-card-actions">
            <a href="simulator.html?mass=${s.massKg?(parseFloat(s.massKg)*1000).toFixed(0):''}&impulse=${s.impulseNs}&burntime=${s.burnTime}&cd=${s.cd}&diameter=${s.diamMm}" class="history-btn">🔄 Re-run</a>
            <button class="history-btn danger" onclick="deleteSimulation('${s.id}',this)">🗑️ Delete</button>
          </div>
        </div>`).join('');

    // Designs
    const desEl=document.getElementById('designs-list');
    desEl.innerHTML = !designDocs.length
      ? '<p style="color:var(--muted);font-size:13px;">No saved designs yet.</p>'
      : designDocs.map(d=>`
        <div class="design-card">
          <div class="design-card-header">
            <span class="design-card-name">🚀 ${d.name}</span>
            <span class="design-card-date">${new Date(d.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
          </div>
          <div class="design-card-params">Mass: ${d.mass}g · Diameter: ${d.diameter}mm · Body: ${d.bodylen}mm · Nose: ${d.noselen}mm · Fins: ${d.nfins}×(${d.finspan}mm span)</div>
          <div class="history-card-actions" style="margin-top:10px;">
            <a href="simulator.html?mass=${d.mass}&diameter=${d.diameter}&noselen=${d.noselen}&bodylen=${d.bodylen}&finspan=${d.finspan}&finroot=${d.finroot}&fintip=${d.fintip}&nfins=${d.nfins}&cd=${d.cd}&impulse=${d.impulse}&burntime=${d.burntime}" class="history-btn">🚀 Load in Simulator</a>
            <button class="history-btn danger" onclick="deleteDesign('${d.id}',this)">🗑️ Delete</button>
          </div>
        </div>`).join('');

    // Chats
    const chatEl=document.getElementById('chats-list');
    chatEl.innerHTML = !chatDocs.length
      ? '<p style="color:var(--muted);font-size:13px;">No AI chats saved yet.</p>'
      : chatDocs.map(c=>`
        <div class="chat-card">
          <div class="chat-card-header">
            <span class="chat-card-title">Motor ${c.flightData?.motorClass||'—'} · ${c.flightData?.maxAlt||'—'} m</span>
            <span class="chat-card-date">${new Date(c.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
          </div>
          <div class="chat-preview">${c.firstReply?c.firstReply.substring(0,200)+'...':'No preview available.'}</div>
        </div>`).join('');

    window.deleteSimulation = async (id,btn) => {
      await deleteDoc(doc(db,'users',user.uid,'simulations',id));
      btn.closest('.history-card').remove();
    };
    window.deleteDesign = async (id,btn) => {
      await deleteDoc(doc(db,'users',user.uid,'designs',id));
      btn.closest('.design-card').remove();
    };
    window.clearHistory = async () => {
      if (!confirm('Delete all simulation history? This cannot be undone.')) return;
      for (const s of simDocs) await deleteDoc(doc(db,'users',user.uid,'simulations',s.id));
      document.getElementById('history-list').innerHTML='<p style="color:var(--muted);font-size:13px;">History cleared.</p>';
    };
  });
}

window.switchProfileTab = (tab) => {
  document.querySelectorAll('.tab-btn').forEach((btn,i)=>btn.classList.toggle('active',['history','designs','chats'][i]===tab));
  ['history','designs','chats'].forEach(t=>{
    document.getElementById('profile-tab-'+t).classList.toggle('active',t===tab);
  });
};