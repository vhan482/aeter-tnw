import { useEffect, useState } from 'react';
import App from './App';
import './officer-access.css';

type Role = 'GUILD_LEADER' | 'OFFICER' | 'CLERK';
type Officer = {
  id: string; username: string; displayName: string; role: Role;
  mustChangePassword: boolean;
};
type OfficerListItem = Officer & { active: boolean };
type ApiError = { error?: string };
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as ApiError;
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function OfficerManager({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<OfficerListItem[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'OFFICER' | 'CLERK'>('OFFICER');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    const data = await api<{ officers: OfficerListItem[] }>('/api/officers');
    setItems(data.officers);
  }
  useEffect(() => {
    let active = true;
    void api<{ officers: OfficerListItem[] }>('/api/officers')
      .then(data => { if (active) setItems(data.officers); })
      .catch(e => { if (active) setNotice(e instanceof Error ? e.message : 'Cannot load officers'); });
    return () => { active = false; };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      await api('/api/officers', { method: 'POST', body: JSON.stringify({
        username, displayName, role, temporaryPassword
      }) });
      setUsername(''); setDisplayName(''); setTemporaryPassword('');
      await reload();
      setNotice('Officer created. Share the temporary password privately; they must change it on first sign-in.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Creation failed'); }
    finally { setBusy(false); }
  }
  async function disable(item: OfficerListItem) {
    if (!window.confirm(`Disable ${item.username} and revoke their sessions?`)) return;
    setBusy(true); setNotice('');
    try {
      await api(`/api/officers/${item.id}/disable`, { method: 'POST' });
      await reload(); setNotice('Officer disabled and sessions revoked.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Disable failed'); }
    finally { setBusy(false); }
  }
  async function reset(item: OfficerListItem) {
    if (!window.confirm(`Reset ${item.username}'s password and sign them out everywhere?`)) return;
    setBusy(true); setNotice('');
    try {
      await api(`/api/officers/${item.id}/reset-password`, {
        method: 'POST', body: JSON.stringify({ temporaryPassword: resetValue })
      });
      setResetId(null); setResetValue(''); await reload();
      setNotice('Password reset. Share the temporary password privately.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Reset failed'); }
    finally { setBusy(false); }
  }
  return <div className="officer-overlay" role="dialog" aria-modal="true" aria-label="Manage officers">
    <section className="officer-modal">
      <div className="officer-row">
        <div><h2>Officer access</h2><p>Only the Guild Leader can provision accounts. There is no public registration.</p></div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {notice && <p role="status" className="officer-notice">{notice}</p>}
      <form onSubmit={e => void add(e)} className="officer-grid">
        <label>Login username<input value={username} autoComplete="off" required minLength={3} maxLength={32} onChange={e=>setUsername(e.target.value)} /></label>
        <label>Display name<input value={displayName} required maxLength={80} onChange={e=>setDisplayName(e.target.value)} /></label>
        <label>Role<select value={role} onChange={e=>setRole(e.target.value as 'OFFICER'|'CLERK')}>
          <option value="OFFICER">Officer</option><option value="CLERK">Clerk</option>
        </select></label>
        <label>Temporary password<input type="password" autoComplete="new-password" minLength={12} maxLength={128}
          value={temporaryPassword} required onChange={e=>setTemporaryPassword(e.target.value)} /></label>
        <button disabled={busy} type="submit" className="officer-primary">Create officer account</button>
      </form>
      <h3>Authorized accounts</h3>
      <div className="officer-list">
        {items.map(item=><div key={item.id} className="officer-account">
          <div><strong>{item.displayName}</strong><small>@{item.username} · {item.role} · {item.active?'Active':'Disabled'}{item.mustChangePassword?' · Password change required':''}</small></div>
          {item.active && <div className="officer-actions">
            {resetId===item.id ? <>
              <input aria-label={`New temporary password for ${item.username}`} placeholder="New temporary password" type="password"
                autoComplete="new-password" minLength={12} value={resetValue} onChange={e=>setResetValue(e.target.value)}/>
              <button disabled={busy || resetValue.length<12} onClick={()=>void reset(item)}>Apply reset</button>
              <button onClick={()=>{setResetId(null);setResetValue('');}}>Cancel</button>
            </> : <button disabled={busy} onClick={()=>{setResetId(item.id);setResetValue('');}}>Reset password</button>}
            <button disabled={busy} onClick={()=>void disable(item)}>Disable</button>
          </div>}
        </div>)}
      </div>
    </section>
  </div>;
}

export default function OfficerAccess() {
  const [phase, setPhase] = useState<'loading'|'guest'|'officer'>('loading');
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    let active = true;
    void api<{ officer: Officer }>('/api/auth/me').then(data => {
      if (active) { setOfficer(data.officer); setPhase('officer'); }
    }).catch(() => { if (active) setPhase('guest'); });
    return () => { active = false; };
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api<{officer:Officer}>('/api/auth/login', {
        method:'POST', body: JSON.stringify({username,password})
      });
      setPassword(''); setOfficer(data.officer); setPhase('officer');
    } catch(e) {setError(e instanceof Error ? e.message : 'Sign-in failed');}
    finally {setBusy(false);}
  }
  async function change(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data=await api<{officer:Officer}>('/api/auth/change-password', {
        method:'POST', body:JSON.stringify({currentPassword,newPassword})
      });
      setCurrentPassword('');setNewPassword('');setOfficer(data.officer);
    } catch(e) {setError(e instanceof Error?e.message:'Password change failed');}
    finally {setBusy(false);}
  }
  async function logout() {
    setBusy(true);setError('');
    try {
      await api('/api/auth/logout',{method:'POST'});
      setOfficer(null);setManage(false);setPhase('guest');
    }catch(e){setError(e instanceof Error?e.message:'Unable to sign out');}
    finally{setBusy(false);}
  }
  if (phase==='loading') return <main className="officer-auth-shell"><section className="officer-auth-card"><h1>Aeternum</h1><p>Checking officer session…</p></section></main>;
  if (phase==='guest' || !officer) return <main className="officer-auth-shell"><section className="officer-auth-card">
    <div className="officer-emblem">⚔</div><h1>Aeternum</h1><p>Guild Operations · Officer Access</p>
    <p className="officer-caption">Only guild leadership, approved officers and clerks may sign in.</p>
    <form onSubmit={e=>void login(e)}>
      <label>Username<input autoFocus autoComplete="username" value={username} required
        onChange={e=>setUsername(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} required
        onChange={e=>setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="officer-error">{error}</p>}
      <button className="officer-primary" disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button>
    </form>
    <small>Accounts are provisioned by the Guild Leader. No public registration.</small>
  </section></main>;
  if (officer.mustChangePassword) return <main className="officer-auth-shell"><section className="officer-auth-card">
    <h1>Set your password</h1><p>Change your temporary password to continue.</p>
    <form onSubmit={e=>void change(e)}>
      <label>Temporary password<input autoComplete="current-password" type="password" value={currentPassword}
        onChange={e=>setCurrentPassword(e.target.value)} required /></label>
      <label>New password (at least 12 characters)<input autoComplete="new-password" type="password" value={newPassword}
        onChange={e=>setNewPassword(e.target.value)} minLength={12} maxLength={128} required /></label>
      {error&&<p role="alert" className="officer-error">{error}</p>}
      <button type="submit" disabled={busy} className="officer-primary">Change password</button>
    </form>
    <button type="button" onClick={()=>void logout()} disabled={busy}>Sign out</button>
  </section></main>;
  return <>
    <App officer={officer} onSignOut={()=>void logout()} onManageOfficers={()=>setManage(true)} />
    {error && <div className="officer-global-error" role="alert">{error}</div>}
    {manage && officer.role==='GUILD_LEADER' && <OfficerManager onClose={()=>setManage(false)} />}
  </>;
}
