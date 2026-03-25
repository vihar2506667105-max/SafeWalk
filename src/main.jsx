import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import './styles.css';

const DEMO_USERS = {
  woman: { id: 'ananya', name: 'Ananya', role: 'woman' },
  handler: { id: 'rahul', name: 'Rahul (Guardian)', role: 'handler' }
};

const initialState = {
  walkActive: false,
  safetyLevel: 'safe',
  positionIndex: 0,
  route: [
    { x: 12, y: 78, zone: 'safe' },
    { x: 20, y: 70, zone: 'safe' },
    { x: 30, y: 64, zone: 'moderate' },
    { x: 42, y: 57, zone: 'moderate' },
    { x: 54, y: 49, zone: 'danger' },
    { x: 66, y: 42, zone: 'danger' },
    { x: 78, y: 34, zone: 'safe' }
  ],
  sos: { active: false, status: 'idle', countdown: 20, acceptedBy: null },
  guardians: [{ id: 'rahul', name: 'Rahul', active: true, x: 74, y: 39 }],
  escortRequested: false,
  chat: [
    { id: crypto.randomUUID(), user: 'Anon', text: 'Street lights are weak near Oak Road.', type: 'report' }
  ],
  timeline: []
};

function useSyncedState() {
  const [state, setState] = React.useState(() => {
    const raw = localStorage.getItem('safewalk:state');
    return raw ? JSON.parse(raw) : initialState;
  });

  React.useEffect(() => {
    localStorage.setItem('safewalk:state', JSON.stringify(state));
  }, [state]);

  React.useEffect(() => {
    const channel = new BroadcastChannel('safewalk-sync');
    channel.onmessage = (ev) => setState(ev.data);
    return () => channel.close();
  }, []);

  const syncSetState = React.useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const channel = new BroadcastChannel('safewalk-sync');
      channel.postMessage(next);
      channel.close();
      return next;
    });
  }, []);

  return [state, syncSetState];
}

function App() {
  const [session, setSession] = React.useState(() => {
    const raw = localStorage.getItem('safewalk:session');
    return raw ? JSON.parse(raw) : null;
  });
  const [theme, setTheme] = React.useState(() => localStorage.getItem('safewalk:theme') || 'dark');
  const [state, setState] = useSyncedState();
  const [simulationRunning, setSimulationRunning] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('safewalk:theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (session) localStorage.setItem('safewalk:session', JSON.stringify(session));
    else localStorage.removeItem('safewalk:session');
  }, [session]);

  React.useEffect(() => {
    if (!state.walkActive) return;
    const i = setInterval(() => {
      setState((prev) => {
        const nextIndex = Math.min(prev.positionIndex + 1, prev.route.length - 1);
        const zone = prev.route[nextIndex].zone;
        const timeline = [...prev.timeline];
        if (zone === 'danger' && prev.safetyLevel !== 'danger') {
          timeline.push({ at: new Date().toLocaleTimeString(), text: '⚠ Low Safety Area Detected' });
        }
        return {
          ...prev,
          positionIndex: nextIndex,
          safetyLevel: zone,
          timeline,
          walkActive: nextIndex < prev.route.length - 1
        };
      });
    }, 2600);
    return () => clearInterval(i);
  }, [state.walkActive, setState]);

  React.useEffect(() => {
    if (!state.sos.active || state.sos.acceptedBy) return;
    const i = setInterval(() => {
      setState((prev) => {
        const countdown = Math.max(prev.sos.countdown - 1, 0);
        const status = countdown === 0 ? 'No guardian accepted yet. Retrying...' : prev.sos.status;
        return { ...prev, sos: { ...prev.sos, countdown, status } };
      });
    }, 1000);
    return () => clearInterval(i);
  }, [state.sos.active, state.sos.acceptedBy, setState]);

  const login = (user) => setSession({ ...user, loggedAt: Date.now() });

  const runSimulation = async () => {
    setSimulationRunning(true);
    setState((p) => ({ ...p, walkActive: true, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'Walk started by Ananya' }] }));
    await delay(7000);
    setState((p) => ({ ...p, sos: { ...p.sos, active: true, status: 'Searching for nearby help…' }, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'SOS triggered' }] }));
    await delay(3500);
    setState((p) => ({ ...p, sos: { ...p.sos, acceptedBy: 'Rahul', status: 'Rahul accepted and is on the way' }, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'Rahul accepted request' }] }));
    setSimulationRunning(false);
  };

  return (
    <div className="app-shell">
      <BackgroundFX />
      <header className="topbar glass">
        <div>
          <h1>SafeWalk — Women Safety Companion</h1>
          <p>Human-centered realtime protection network.</p>
        </div>
        <div className="top-actions">
          <button className="chip" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
          <button className="chip primary" onClick={runSimulation} disabled={simulationRunning}>{simulationRunning ? 'Simulation Running...' : 'Try Live Demo'}</button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!session ? (
          <motion.section key="auth" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="auth-wrap">
            <AuthCard onLogin={login} />
          </motion.section>
        ) : (
          <motion.main key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="split-layout">
            <UserPanel role="woman" user={DEMO_USERS.woman} state={state} setState={setState} />
            <UserPanel role="handler" user={DEMO_USERS.handler} state={state} setState={setState} />
            <aside className="dashboard glass">
              <Dashboard state={state} session={session} onLogout={() => setSession(null)} />
            </aside>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthCard({ onLogin }) {
  const [mode, setMode] = React.useState('signup');
  const [role, setRole] = React.useState('woman');
  const [name, setName] = React.useState('');

  return (
    <div className="auth-card glass">
      <h2>{mode === 'signup' ? 'Create your SafeWalk access' : 'Welcome back'}</h2>
      <p>Role-based access with persistent session simulation.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <div className="role-pills">
        <button className={role === 'woman' ? 'active' : ''} onClick={() => setRole('woman')}>I need protection</button>
        <button className={role === 'handler' ? 'active' : ''} onClick={() => setRole('handler')}>I can help</button>
      </div>
      <button className="chip primary" onClick={() => onLogin({ name: name || (role === 'woman' ? 'Ananya' : 'Rahul'), role })}>{mode === 'signup' ? 'Sign up' : 'Login'}</button>
      <button className="chip" onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}>{mode === 'signup' ? 'Already have account? Login' : 'Need an account? Sign up'}</button>
    </div>
  );
}

function UserPanel({ role, user, state, setState }) {
  const pos = state.route[state.positionIndex];
  const isWoman = role === 'woman';
  const zoneColor = state.safetyLevel === 'danger' ? 'var(--danger)' : state.safetyLevel === 'moderate' ? 'var(--warn)' : 'var(--safe)';

  return (
    <section className={`panel ${isWoman ? 'left' : 'right'} glass`}>
      <div className="panel-head">
        <h3>{user.name}</h3>
        <span>{isWoman ? 'Subject Interface' : 'Handler Interface'}</span>
      </div>
      <MapScene state={state} role={role} />
      <div className="status-line" style={{ borderColor: zoneColor }}>
        Safety Zone: <strong>{state.safetyLevel.toUpperCase()}</strong> · Position {state.positionIndex + 1}/{state.route.length}
      </div>

      {isWoman ? (
        <div className="actions">
          <button className="chip" onClick={() => setState((p) => ({ ...p, walkActive: true }))}>Start Walk</button>
          <button className="chip" onClick={() => setState((p) => ({ ...p, escortRequested: true, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'Escort requested' }] }))}>Request Escort</button>
          <button className="chip danger" onClick={() => setState((p) => ({ ...p, sos: { ...p.sos, active: true, status: 'Searching for nearby help…', countdown: 20 }, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'SOS triggered by Ananya' }] }))}>SOS</button>
          {state.sos.acceptedBy && <div className="live-banner">✅ Help is on the way ({state.sos.acceptedBy})</div>}
        </div>
      ) : (
        <div className="actions">
          <button className={`chip ${state.guardians[0].active ? 'primary' : ''}`} onClick={() => setState((p) => ({ ...p, guardians: [{ ...p.guardians[0], active: !p.guardians[0].active }] }))}>{state.guardians[0].active ? 'Go Inactive' : 'Go Active'}</button>
          <button className="chip" disabled={!state.sos.active || !!state.sos.acceptedBy} onClick={() => setState((p) => ({ ...p, sos: { ...p.sos, acceptedBy: 'Rahul', status: 'Rahul accepted and is on the way' }, timeline: [...p.timeline, { at: new Date().toLocaleTimeString(), text: 'Rahul accepted SOS' }] }))}>Accept SOS</button>
          <button className="chip" onClick={() => setState((p) => ({ ...p, sos: { ...p.sos, status: 'Request rejected, searching next guardian' } }))}>Reject</button>
          {state.sos.active && <div className="live-banner">Incoming SOS · {state.sos.status} · ETA track enabled</div>}
        </div>
      )}

      <ChatBox state={state} setState={setState} isWoman={isWoman} />
      {state.sos.active && <SosOverlay sos={state.sos} />}
    </section>
  );
}

function MapScene({ state, role }) {
  const pos = state.route[state.positionIndex];
  return (
    <div className="map glass-inner">
      <svg viewBox="0 0 100 100" className="map-svg">
        <polyline points={state.route.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(120,170,255,.55)" strokeWidth="1.6" strokeDasharray="2 2" />
        {state.route.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1" fill={p.zone === 'danger' ? '#ff5da2' : p.zone === 'moderate' ? '#f5b743' : '#6ee7b7'} opacity="0.8" />)}
        <motion.circle cx={pos.x} cy={pos.y} r="2.3" fill="#3b82f6" animate={{ scale: [1, 1.8, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
        {role === 'handler' && state.sos.active && <motion.circle cx={pos.x} cy={pos.y} r="4" fill="transparent" stroke="#ff5da2" strokeWidth="0.7" animate={{ r: [4, 11], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} />}
      </svg>
    </div>
  );
}

function ChatBox({ state, setState, isWoman }) {
  const [text, setText] = React.useState('');
  return (
    <div className="chat glass-inner">
      <div className="chat-head">Anonymous Local Chat</div>
      <div className="chat-log">
        {state.chat.slice(-4).map((m) => <div key={m.id}><b>{m.user}:</b> {m.text}</div>)}
      </div>
      <div className="chat-actions">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Share update" />
        <button className="chip" onClick={() => { if (!text.trim()) return; setState((p) => ({ ...p, chat: [...p.chat, { id: crypto.randomUUID(), user: isWoman ? 'Anon-W' : 'Anon-H', text } ] })); setText(''); }}>Send</button>
        <button className="chip danger" onClick={() => setState((p) => ({ ...p, chat: [...p.chat, { id: crypto.randomUUID(), user: 'Report', text: 'Suspicious activity reported in this area.', type: 'report' }] }))}>Report</button>
      </div>
    </div>
  );
}

function SosOverlay({ sos }) {
  return (
    <div className="sos-overlay">
      <motion.div className="radar" animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.3 }} />
      <div className="sos-text">🚨 {sos.status}</div>
      <div className="sos-countdown">{sos.acceptedBy ? 'Responder assigned' : `T-${sos.countdown}s`}</div>
    </div>
  );
}

function Dashboard({ state, session, onLogout }) {
  const safetyScore = Math.max(30, 95 - state.timeline.length * 2 - (state.safetyLevel === 'danger' ? 18 : 0) + (state.sos.acceptedBy ? 12 : 0));
  return (
    <>
      <h4>Mission Dashboard</h4>
      <p>Logged in as {session.name} ({session.role})</p>
      <div className="score">Safety Score: {safetyScore}</div>
      <div className="metric">Walk active: {String(state.walkActive)}</div>
      <div className="metric">Escort requested: {String(state.escortRequested)}</div>
      <div className="metric">SOS: {state.sos.active ? 'Active' : 'Idle'}</div>
      <div className="timeline">
        {state.timeline.slice(-8).map((t, i) => <div key={i}><span>{t.at}</span> {t.text}</div>)}
      </div>
      <button className="chip" onClick={onLogout}>Logout</button>
    </>
  );
}

function BackgroundFX() {
  return <div className="bg-fx" aria-hidden />;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
