import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const blankUser = { name: '', email: '', password: '', accountType: 'employee' };
const blankTeam = { name: '', description: '' };
const blankPermission = { code: '', label: '', description: '' };
const blankRole = { name: '', description: '' };

const navigation = [
  { id: 'overview',     label: 'Overview',       icon: DashboardIcon },
  { id: 'users',        label: 'Users',           icon: UsersIcon },
  { id: 'teams',        label: 'Teams',           icon: TeamIcon },
  { id: 'roles',        label: 'Roles',           icon: RolesIcon },
  { id: 'permissions',  label: 'Permissions',     icon: ShieldIcon },
  { id: 'memberships',  label: 'Memberships',     icon: LinkIcon },
  { id: 'access',       label: 'Access Matrix',   icon: MatrixIcon },
];

// Employee only sees these two — their personal dashboard + permission lookup
const employeeNav = [
  { id: 'overview', label: 'Overview',    icon: DashboardIcon },
  { id: 'access',   label: 'My Access',   icon: MatrixIcon },
];

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('rengy-token');
    const user  = localStorage.getItem('rengy-user');
    return { token, user: user ? JSON.parse(user) : null, ready: false };
  });
  const [authMode,   setAuthMode]   = useState('signin');
  const [authForm,   setAuthForm]   = useState(blankUser);
  const [activeModule, setActiveModule] = useState('overview');
  const [users,       setUsers]       = useState([]);
  const [teams,       setTeams]       = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles,       setRoles]       = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [effectiveAccess, setEffectiveAccess] = useState({ roles: [], permissions: [] });
  const [selectedUserId,          setSelectedUserId]          = useState('');
  const [selectedTeamId,          setSelectedTeamId]          = useState('');
  const [selectedRoleId,          setSelectedRoleId]          = useState('');
  const [selectedRolePermissionIds, setSelectedRolePermissionIds] = useState([]);
  const [selectedMemberRoleIds,   setSelectedMemberRoleIds]   = useState([]);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchTeams, setSearchTeams] = useState('');
  const [userForm,       setUserForm]       = useState(blankUser);
  const [teamForm,       setTeamForm]       = useState(blankTeam);
  const [permissionForm, setPermissionForm] = useState(blankPermission);
  const [roleForm,       setRoleForm]       = useState(blankRole);
  const [status,  setStatus]  = useState('Loading workspace...');
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const restore = async () => {
      if (!auth.token) { setAuth(c => ({ ...c, ready: true })); return; }
      try {
        const result = await api.me();
        localStorage.setItem('rengy-user', JSON.stringify(result.user));
        setAuth({ token: auth.token, user: result.user, ready: true });
      } catch {
        localStorage.removeItem('rengy-token');
        localStorage.removeItem('rengy-user');
        setAuth({ token: null, user: null, ready: true });
      }
    };
    restore();
  }, []);

  useEffect(() => { if (auth.token) loadReferenceData(); }, [auth.token]);
  useEffect(() => { if (auth.token) loadDirectory();     }, [auth.token, searchUsers, searchTeams]);

  useEffect(() => {
    if (selectedTeamId) loadTeamMembers(selectedTeamId);
    else setTeamMembers([]);
  }, [selectedTeamId]);

  useEffect(() => {
    if (selectedTeamId && selectedUserId) loadEffectiveAccess(selectedTeamId, selectedUserId);
    else setEffectiveAccess({ roles: [], permissions: [] });
  }, [selectedTeamId, selectedUserId]);

  useEffect(() => {
    if (!selectedRoleId && roles.length) {
      setSelectedRoleId(roles[0]._id);
      setSelectedRolePermissionIds(roles[0].permissions?.map(p => p._id) || []);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId) {
      const role = roles.find(r => r._id === selectedRoleId);
      setSelectedRolePermissionIds(role?.permissions?.map(p => p._id) || []);
    }
  }, [selectedRoleId, roles]);

  useEffect(() => {
    if (selectedTeamId && selectedUserId) {
      const member = teamMembers.find(m => m.user?._id === selectedUserId);
      setSelectedMemberRoleIds(member?.roles?.map(r => r._id) || []);
    }
  }, [selectedTeamId, selectedUserId, teamMembers]);

  useEffect(() => { if (!selectedUserId && users.length) setSelectedUserId(users[0]._id); }, [users, selectedUserId]);
  useEffect(() => { if (!selectedTeamId && teams.length) setSelectedTeamId(teams[0]._id); }, [teams, selectedTeamId]);

  const isAdmin    = auth.user?.accountType === 'admin';
  const moduleList = useMemo(
    () => isAdmin ? navigation : employeeNav,
    [isAdmin]
  );

  async function loadDirectory() {
    try {
      setBusy(true); setError('');
      const [ur, tr] = await Promise.all([api.getUsers(searchUsers), api.getTeams(searchTeams)]);
      setUsers(ur.items || []);
      setTeams(tr.items || []);
      if (!selectedUserId && ur.items?.length) setSelectedUserId(ur.items[0]._id);
      if (!selectedTeamId && tr.items?.length) setSelectedTeamId(tr.items[0]._id);
      setStatus('Directory refreshed');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function loadReferenceData() {
    try {
      setBusy(true); setError('');
      const [pr, rr] = await Promise.all([api.getPermissions(), api.getRoles()]);
      setPermissions(pr.items || []);
      setRoles(rr.items || []);
      setStatus('RBAC catalog loaded');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function loadTeamMembers(teamId) {
    try { const r = await api.getTeamMembers(teamId); setTeamMembers(r.items || []); }
    catch (err) { setError(err.message); }
  }

  async function loadEffectiveAccess(teamId, userId) {
    try {
      const r = await api.getUserPermissionsInTeam(teamId, userId);
      setEffectiveAccess({ roles: r.roles || [], permissions: r.permissions || [] });
    } catch (err) { setError(err.message); }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    try {
      setBusy(true); setError('');
      const payload = authMode === 'signin'
        ? { email: authForm.email, password: authForm.password }
        : { name: authForm.name, email: authForm.email, password: authForm.password, accountType: 'employee' };
      const result = authMode === 'signin' ? await api.signIn(payload) : await api.signUp(payload);
      localStorage.setItem('rengy-token', result.token);
      localStorage.setItem('rengy-user', JSON.stringify(result.user));
      setAuth({ token: result.token, user: result.user, ready: true });
      setStatus('Authenticated'); setAuthForm(blankUser);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function logout() {
    localStorage.removeItem('rengy-token');
    localStorage.removeItem('rengy-user');
    setAuth({ token: null, user: null, ready: true });
    setActiveModule('overview'); setStatus('Logged out');
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try { setBusy(true); await api.createUser(userForm); setUserForm(blankUser); await loadDirectory(); setStatus('User created'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    try { setBusy(true); await api.createTeam(teamForm); setTeamForm(blankTeam); await loadDirectory(); setStatus('Team created'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleCreatePermission(e) {
    e.preventDefault();
    try { setBusy(true); await api.createPermission(permissionForm); setPermissionForm(blankPermission); await loadReferenceData(); setStatus('Permission created'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleCreateRole(e) {
    e.preventDefault();
    try { setBusy(true); await api.createRole(roleForm); setRoleForm(blankRole); await loadReferenceData(); setStatus('Role created'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleAssignPermissionsToRole(e) {
    e.preventDefault();
    if (!selectedRoleId) { setError('Pick a role first'); return; }
    try {
      setBusy(true);
      await api.setRolePermissions(selectedRoleId, selectedRolePermissionIds);
      await loadReferenceData();
      await loadTeamMembers(selectedTeamId);
      setStatus('Role permissions updated');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleAssignMember(e) {
    e.preventDefault();
    if (!selectedUserId || !selectedTeamId) { setError('Select both a user and a team'); return; }
    try {
      setBusy(true);
      await api.addUserToTeam(selectedTeamId, { userId: selectedUserId, roleIds: selectedMemberRoleIds });
      await loadTeamMembers(selectedTeamId);
      await loadEffectiveAccess(selectedTeamId, selectedUserId);
      setStatus('Membership updated');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function handleRemoveMember(userId) {
    try {
      setBusy(true);
      await api.removeUserFromTeam(selectedTeamId, userId);
      await loadTeamMembers(selectedTeamId);
      setSelectedMemberRoleIds([]);
      if (selectedUserId === userId) setEffectiveAccess({ roles: [], permissions: [] });
      setStatus('Member removed');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!auth.ready) return <AuthLoading />;
  if (!auth.user)  return (
    <AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm}
      onSubmit={handleAuthSubmit} busy={busy} error={error} />
  );

  return (
    <div className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">RB</div>
          <div className={`brand-text${sidebarOpen ? '' : ' hidden'}`}>
            <strong>Rengy RBAC</strong>
            <span>Enterprise control plane</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {moduleList.map(entry => (
            <button key={entry.id} type="button"
              className={`nav-btn${activeModule === entry.id ? ' active' : ''}`}
              onClick={() => setActiveModule(entry.id)}
              title={entry.label} aria-label={entry.label}>
              <entry.icon />
              {sidebarOpen && <span>{entry.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen ? (
            <>
              <span className="role-badge">{auth.user.accountType}</span>
              <strong className="user-name">{auth.user.name}</strong>
              <span className="user-email">{auth.user.email}</span>
              <button type="button" className="btn-ghost w-full" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button type="button" className="btn-ghost icon-only" onClick={logout} title="Sign out" aria-label="Sign out">
              <SignOutIcon />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="btn-icon" onClick={() => setSidebarOpen(o => !o)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              <MenuIcon />
            </button>
            <div>
              <p className="page-eyebrow">Authenticated workspace</p>
              <h1 className="page-title">{moduleTitle(activeModule)}</h1>
            </div>
          </div>
          <div className="topbar-right">
            <span className="status-text">{status}</span>
            <span className={`access-badge${isAdmin ? ' admin' : ''}`}>{isAdmin ? 'Admin' : 'Employee'}</span>
          </div>
        </header>

        <div className="page-body">
          {error && (
            <div className="alert-bar" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss">✕</button>
            </div>
          )}

          {activeModule === 'overview' && (
            <OverviewPanel users={users} teams={teams} permissions={permissions} roles={roles}
              user={auth.user}
              isAdmin={isAdmin}
              selectedUser={users.find(u => u._id === selectedUserId)}
              selectedTeam={teams.find(t => t._id === selectedTeamId)}
              effectiveAccess={effectiveAccess} />
          )}
          {activeModule === 'users' && (
            <UsersPanel users={users} searchUsers={searchUsers} setSearchUsers={setSearchUsers}
              userForm={userForm} setUserForm={setUserForm} onCreateUser={handleCreateUser}
              busy={busy} isAdmin={isAdmin} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />
          )}
          {activeModule === 'teams' && (
            <TeamsPanel teams={teams} searchTeams={searchTeams} setSearchTeams={setSearchTeams}
              teamForm={teamForm} setTeamForm={setTeamForm} onCreateTeam={handleCreateTeam}
              busy={busy} isAdmin={isAdmin} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} />
          )}
          {activeModule === 'roles' && (
            <RolesPanel roles={roles} permissions={permissions}
              roleForm={roleForm} setRoleForm={setRoleForm} onCreateRole={handleCreateRole}
              selectedRoleId={selectedRoleId} setSelectedRoleId={setSelectedRoleId}
              selectedRolePermissionIds={selectedRolePermissionIds}
              setSelectedRolePermissionIds={setSelectedRolePermissionIds}
              onSaveRolePermissions={handleAssignPermissionsToRole}
              busy={busy} isAdmin={isAdmin} />
          )}
          {activeModule === 'permissions' && (
            <PermissionsPanel permissions={permissions}
              permissionForm={permissionForm} setPermissionForm={setPermissionForm}
              onCreatePermission={handleCreatePermission} busy={busy} isAdmin={isAdmin} />
          )}
          {activeModule === 'memberships' && (
            <MembershipsPanel users={users} teams={teams} roles={roles} teamMembers={teamMembers}
              selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId}
              selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId}
              selectedMemberRoleIds={selectedMemberRoleIds} setSelectedMemberRoleIds={setSelectedMemberRoleIds}
              onSaveMembership={handleAssignMember} onRemoveMember={handleRemoveMember}
              busy={busy} isAdmin={isAdmin} />
          )}
          {activeModule === 'access' && (
            <AccessPanel users={users} teams={teams} currentUser={auth.user} isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────── */
function AuthLoading() {
  return <div className="auth-loading"><span>Loading workspace…</span></div>;
}

function AuthPage({ mode, setMode, form, setForm, onSubmit, busy, error }) {
  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero-badge">Enterprise RBAC · JWT enabled</div>
        <h1>Role-based access control for modern teams</h1>
        <p>Manage users, teams, roles, and permissions from one clean workspace.</p>
        <div className="auth-chips">
          {['Users','Teams','Roles','Permissions','Access Matrix'].map(c => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>Sign in</button>
          <button type="button" className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === 'signup' && (
            <Field label="Full name">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" required />
            </Field>
          )}
          <Field label="Email address">
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" required />
          </Field>
          <Field label="Password">
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-hint">
          <strong>Admin credentials</strong>
          <p>Use the seeded admin email and password from the server <code>.env</code> file.</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   OVERVIEW  — admin sees system stats, employee sees their own access
───────────────────────────────────────────────────────── */
function OverviewPanel({ users, teams, permissions, roles, user, selectedUser, selectedTeam, effectiveAccess, isAdmin }) {
  if (!isAdmin) {
    return <EmployeeOverview user={user} teams={teams} />;
  }

  return (
    <div className="overview-layout">
      <div className="stats-row">
        <StatCard label="Users"       value={users.length}       icon={<UsersIcon />} />
        <StatCard label="Teams"       value={teams.length}       icon={<TeamIcon />} />
        <StatCard label="Roles"       value={roles.length}       icon={<RolesIcon />} />
        <StatCard label="Permissions" value={permissions.length} icon={<ShieldIcon />} />
      </div>

      <div className="overview-body">
        <div className="overview-main">
          <div className="section-header">
            <p className="eyebrow">RBAC Snapshot</p>
            <h2>Workspace at a glance</h2>
          </div>
          <div className="flow-steps">
            <FlowStep step={1} title="Pick a user"    desc={selectedUser ? selectedUser.name : 'No user selected yet'} done={!!selectedUser} />
            <FlowStep step={2} title="Pick a team"    desc={selectedTeam ? selectedTeam.name : 'No team selected yet'} done={!!selectedTeam} />
            <FlowStep step={3} title="Resolve access" desc={`${effectiveAccess.permissions.length} effective permission${effectiveAccess.permissions.length !== 1 ? 's' : ''}`} done={effectiveAccess.permissions.length > 0} />
          </div>
        </div>

        <div className="overview-side">
          <div className="info-card">
            <h3>Current context</h3>
            <div className="kv-list">
              <div className="kv-row"><span>User</span><strong>{selectedUser ? selectedUser.name : '—'}</strong></div>
              <div className="kv-row"><span>Team</span><strong>{selectedTeam ? selectedTeam.name : '—'}</strong></div>
              <div className="kv-row"><span>Account type</span><strong>{user.accountType}</strong></div>
            </div>
          </div>
          <div className="info-card">
            <h3>Effective access</h3>
            <div className="mini-stats">
              <div className="mini-stat"><strong>{effectiveAccess.roles.length}</strong><span>Roles</span></div>
              <div className="mini-stat"><strong>{effectiveAccess.permissions.length}</strong><span>Permissions</span></div>
            </div>
            {effectiveAccess.permissions.length > 0 ? (
              <div className="chip-list">
                {effectiveAccess.permissions.slice(0, 6).map(p => (
                  <span key={p._id} className="chip chip-sm">{p.code}</span>
                ))}
                {effectiveAccess.permissions.length > 6 && (
                  <span className="chip chip-sm muted">+{effectiveAccess.permissions.length - 6} more</span>
                )}
              </div>
            ) : (
              <p className="empty-note">No permissions resolved for this context.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EMPLOYEE OVERVIEW — personal dashboard
   Shows the logged-in user's own team memberships + permissions
───────────────────────────────────────────────────────── */
function EmployeeOverview({ user, teams }) {
  const [myMemberships, setMyMemberships] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [access, setAccess]               = useState({ roles: [], permissions: [] });
  const [accessLoading, setAccessLoading] = useState(false);

  // Load all teams and find which ones this user belongs to
  useEffect(() => {
    const load = async () => {
      try {
        // For each team, try to get this user's permissions — if they have any roles they're a member
        const results = await Promise.all(
          teams.map(t =>
            api.getUserPermissionsInTeam(t._id, user._id)
              .then(r => ({ team: t, roles: r.roles || [], permissions: r.permissions || [] }))
              .catch(() => null)
          )
        );
        const active = results.filter(r => r && r.roles.length > 0);
        setMyMemberships(active);
        if (active.length > 0) setSelectedTeamId(active[0].team._id);
      } finally {
        setLoading(false);
      }
    };
    if (teams.length > 0) load();
    else setLoading(false);
  }, [teams, user._id]);

  // When selected team changes, update the access view
  useEffect(() => {
    if (!selectedTeamId) return;
    const found = myMemberships.find(m => m.team._id === selectedTeamId);
    if (found) setAccess({ roles: found.roles, permissions: found.permissions });
  }, [selectedTeamId, myMemberships]);

  if (loading) {
    return <div className="empty-note" style={{ padding: '40px', textAlign: 'center' }}>Loading your access…</div>;
  }

  return (
    <div className="overview-layout">
      {/* Personal greeting */}
      <div className="employee-hero">
        <div className="employee-hero-left">
          <div className="employee-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2>Welcome, {user.name.split(' ')[0]}</h2>
            <p>{user.email} · <span className="role-badge">{user.accountType}</span></p>
          </div>
        </div>
        <div className="employee-hero-stats">
          <div className="stat-tile"><strong>{myMemberships.length}</strong><span>Teams</span></div>
          <div className="stat-tile">
            <strong>{[...new Set(myMemberships.flatMap(m => m.roles.map(r => r._id)))].length}</strong>
            <span>Roles</span>
          </div>
          <div className="stat-tile">
            <strong>{[...new Map(myMemberships.flatMap(m => m.permissions).map(p => [p._id, p])).values()].length}</strong>
            <span>Total permissions</span>
          </div>
        </div>
      </div>

      {myMemberships.length === 0 ? (
        <div className="info-card">
          <p className="empty-note">You are not a member of any team yet. Ask an admin to add you.</p>
        </div>
      ) : (
        <div className="overview-body">
          {/* Left: team list */}
          <div className="overview-main">
            <div className="section-header">
              <p className="eyebrow">Your teams</p>
              <h2>Select a team to view your access</h2>
            </div>
            <div className="item-list">
              {myMemberships.map(m => (
                <button key={m.team._id} type="button"
                  className={`item-row${m.team._id === selectedTeamId ? ' active' : ''}`}
                  onClick={() => setSelectedTeamId(m.team._id)}>
                  <div className="item-avatar team">{m.team.name.charAt(0).toUpperCase()}</div>
                  <div className="item-info">
                    <strong>{m.team.name}</strong>
                    <span>{m.roles.map(r => r.name).join(', ')}</span>
                  </div>
                  <span className="item-badge">{m.permissions.length} perms</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: permissions for selected team */}
          <div className="overview-side">
            {selectedTeamId && (
              <>
                <div className="info-card">
                  <h3>Your roles in {myMemberships.find(m => m.team._id === selectedTeamId)?.team.name}</h3>
                  <div className="chip-list">
                    {access.roles.map(r => <span key={r._id} className="chip">{r.name}</span>)}
                  </div>
                </div>
                <div className="info-card">
                  <h3>Your permissions</h3>
                  {access.permissions.length === 0 ? (
                    <p className="empty-note">No permissions in this team.</p>
                  ) : (
                    <div className="perm-cards">
                      {access.permissions.map(p => (
                        <div key={p._id} className="perm-card">
                          <div className="perm-card-icon"><ShieldIcon /></div>
                          <div className="perm-card-body">
                            <strong>{p.label || p.code}</strong>
                            <span>{p.code}</span>
                            {p.description && <p>{p.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   USERS
───────────────────────────────────────────────────────── */
function UsersPanel({ users, searchUsers, setSearchUsers, userForm, setUserForm, onCreateUser, busy, isAdmin, selectedUserId, setSelectedUserId }) {
  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>All users <span className="count-badge">{users.length}</span></h2>
        </div>
        <div className="search-bar">
          <SearchIcon />
          <input value={searchUsers} onChange={e => setSearchUsers(e.target.value)} placeholder="Search by name or email…" />
        </div>
        <div className="item-list">
          {users.length === 0 && <p className="empty-note">No users found.</p>}
          {users.map(u => (
            <button key={u._id} type="button"
              className={`item-row${u._id === selectedUserId ? ' active' : ''}`}
              onClick={() => setSelectedUserId(u._id)}>
              <div className="item-avatar">{u.name.charAt(0).toUpperCase()}</div>
              <div className="item-info">
                <strong>{u.name}</strong>
                <span>{u.email}</span>
              </div>
              <span className="item-badge">{u.accountType}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="split-aside">
        <div className="panel-header">
          <h2>Add user</h2>
          {!isAdmin && <span className="perm-note">Admin only</span>}
        </div>
        <form className="form-stack" onSubmit={onCreateUser}>
          <Field label="Full name">
            <input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="Jane Smith" required disabled={!isAdmin} />
          </Field>
          <Field label="Email address">
            <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="jane@company.com" required disabled={!isAdmin} />
          </Field>
          <Field label="Temporary password">
            <input type="text" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="Leave blank for default" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || !isAdmin}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TEAMS
───────────────────────────────────────────────────────── */
function TeamsPanel({ teams, searchTeams, setSearchTeams, teamForm, setTeamForm, onCreateTeam, busy, isAdmin, selectedTeamId, setSelectedTeamId }) {
  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>All teams <span className="count-badge">{teams.length}</span></h2>
        </div>
        <div className="search-bar">
          <SearchIcon />
          <input value={searchTeams} onChange={e => setSearchTeams(e.target.value)} placeholder="Search teams…" />
        </div>
        <div className="item-list">
          {teams.length === 0 && <p className="empty-note">No teams found.</p>}
          {teams.map(t => (
            <button key={t._id} type="button"
              className={`item-row${t._id === selectedTeamId ? ' active' : ''}`}
              onClick={() => setSelectedTeamId(t._id)}>
              <div className="item-avatar team">{t.name.charAt(0).toUpperCase()}</div>
              <div className="item-info">
                <strong>{t.name}</strong>
                <span>{t.description || 'No description'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="split-aside">
        <div className="panel-header">
          <h2>Add team</h2>
          {!isAdmin && <span className="perm-note">Admin only</span>}
        </div>
        <form className="form-stack" onSubmit={onCreateTeam}>
          <Field label="Team name">
            <input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="Engineering" required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} placeholder="Optional description" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || !isAdmin}>
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PERMISSIONS
───────────────────────────────────────────────────────── */
function PermissionsPanel({ permissions, permissionForm, setPermissionForm, onCreatePermission, busy, isAdmin }) {
  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>All permissions <span className="count-badge">{permissions.length}</span></h2>
        </div>
        <div className="item-list">
          {permissions.length === 0 && <p className="empty-note">No permissions defined yet.</p>}
          {permissions.map(p => (
            <div key={p._id} className="item-row no-hover">
              <div className="item-avatar perm">{p.code.charAt(0)}</div>
              <div className="item-info">
                <strong>{p.code}</strong>
                <span>{p.label || p.description || 'No description'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="split-aside">
        <div className="panel-header">
          <h2>Add permission</h2>
          {!isAdmin && <span className="perm-note">Admin only</span>}
        </div>
        <form className="form-stack" onSubmit={onCreatePermission}>
          <Field label="Code">
            <input value={permissionForm.code} onChange={e => setPermissionForm({ ...permissionForm, code: e.target.value })} placeholder="CREATE_TASK" required disabled={!isAdmin} />
          </Field>
          <Field label="Label">
            <input value={permissionForm.label} onChange={e => setPermissionForm({ ...permissionForm, label: e.target.value })} placeholder="Create Task" required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={permissionForm.description} onChange={e => setPermissionForm({ ...permissionForm, description: e.target.value })} placeholder="Allows creating tasks" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || !isAdmin}>
            {busy ? 'Creating…' : 'Create permission'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ROLES
───────────────────────────────────────────────────────── */
function RolesPanel({ roles, permissions, roleForm, setRoleForm, onCreateRole, selectedRoleId, setSelectedRoleId, selectedRolePermissionIds, setSelectedRolePermissionIds, onSaveRolePermissions, busy, isAdmin }) {
  const activeRole = roles.find(r => r._id === selectedRoleId);

  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>All roles <span className="count-badge">{roles.length}</span></h2>
        </div>
        <div className="item-list">
          {roles.length === 0 && <p className="empty-note">No roles defined yet.</p>}
          {roles.map(r => (
            <button key={r._id} type="button"
              className={`item-row${r._id === selectedRoleId ? ' active' : ''}`}
              onClick={() => setSelectedRoleId(r._id)}>
              <div className="item-avatar role">{r.name.charAt(0).toUpperCase()}</div>
              <div className="item-info">
                <strong>{r.name}</strong>
                <span>{r.description || 'No description'}</span>
              </div>
              <span className="item-badge">{r.permissions?.length || 0} perms</span>
            </button>
          ))}
        </div>

        {activeRole && (
          <div className="role-perms-section">
            <div className="panel-header">
              <h3>Permissions for <em>{activeRole.name}</em></h3>
            </div>
            {permissions.length === 0 && <p className="empty-note">No permissions available.</p>}
            <div className="checkbox-grid">
              {permissions.map(p => (
                <label key={p._id} className={`checkbox-item${selectedRolePermissionIds.includes(p._id) ? ' checked' : ''}`}>
                  <input type="checkbox"
                    checked={selectedRolePermissionIds.includes(p._id)}
                    onChange={e => setSelectedRolePermissionIds(cur =>
                      e.target.checked ? [...cur, p._id] : cur.filter(id => id !== p._id)
                    )}
                    disabled={!isAdmin} />
                  <span>{p.code}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn-primary" onClick={onSaveRolePermissions} disabled={busy || !isAdmin}>
              {busy ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        )}
      </div>

      <div className="split-aside">
        <div className="panel-header">
          <h2>Add role</h2>
          {!isAdmin && <span className="perm-note">Admin only</span>}
        </div>
        <form className="form-stack" onSubmit={onCreateRole}>
          <Field label="Role name">
            <input value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Manager" required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Team manager role" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || !isAdmin}>
            {busy ? 'Creating…' : 'Create role'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MEMBERSHIPS
───────────────────────────────────────────────────────── */
function MembershipsPanel({ users, teams, roles, teamMembers, selectedUserId, setSelectedUserId, selectedTeamId, setSelectedTeamId, selectedMemberRoleIds, setSelectedMemberRoleIds, onSaveMembership, onRemoveMember, busy, isAdmin }) {
  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>Team members <span className="count-badge">{teamMembers.length}</span></h2>
        </div>
        <div className="item-list">
          {teamMembers.length === 0 && <p className="empty-note">No members in this team yet.</p>}
          {teamMembers.map(m => (
            <div key={m.user._id} className="item-row no-hover">
              <div className="item-avatar">{m.user.name.charAt(0).toUpperCase()}</div>
              <div className="item-info">
                <strong>{m.user.name}</strong>
                <span>{m.roles?.map(r => r.name).join(', ') || 'No roles'}</span>
              </div>
              {isAdmin && (
                <button type="button" className="btn-danger-sm" onClick={() => onRemoveMember(m.user._id)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="split-aside">
        <div className="panel-header">
          <h2>Assign membership</h2>
          {!isAdmin && <span className="perm-note">Admin only</span>}
        </div>
        <form className="form-stack" onSubmit={onSaveMembership}>
          <Field label="User">
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} required disabled={!isAdmin}>
              <option value="">Select a user</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Team">
            <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} required disabled={!isAdmin}>
              <option value="">Select a team</option>
              {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Roles">
            <div className="checkbox-grid compact">
              {roles.map(r => (
                <label key={r._id} className={`checkbox-item${selectedMemberRoleIds.includes(r._id) ? ' checked' : ''}`}>
                  <input type="checkbox" value={r._id}
                    checked={selectedMemberRoleIds.includes(r._id)}
                    onChange={e => setSelectedMemberRoleIds(
                      e.target.checked ? [...selectedMemberRoleIds, r._id] : selectedMemberRoleIds.filter(id => id !== r._id)
                    )}
                    disabled={!isAdmin} />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <button type="submit" className="btn-primary" disabled={busy || !isAdmin}>
            {busy ? 'Saving…' : 'Save membership'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ACCESS MATRIX
   Admin: pick any user + team
   Employee: locked to themselves, pick team
───────────────────────────────────────────────────────── */
function AccessPanel({ users, teams, currentUser, isAdmin }) {
  const [localUserId, setLocalUserId] = useState('');
  const [localTeamId, setLocalTeamId] = useState('');
  const [access, setAccess] = useState({ roles: [], permissions: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Employees are always looking at themselves
  const effectiveUserId = isAdmin ? localUserId : currentUser._id;

  const selectedUser = isAdmin
    ? users.find(u => u._id === localUserId)
    : currentUser;
  const selectedTeam = teams.find(t => t._id === localTeamId);

  useEffect(() => {
    if (isAdmin && !localUserId && users.length) setLocalUserId(users[0]._id);
  }, [users, isAdmin]);

  useEffect(() => {
    if (!localTeamId && teams.length) setLocalTeamId(teams[0]._id);
  }, [teams]);

  useEffect(() => {
    if (effectiveUserId && localTeamId) {
      setLoading(true); setErr('');
      api.getUserPermissionsInTeam(localTeamId, effectiveUserId)
        .then(r => setAccess({ roles: r.roles || [], permissions: r.permissions || [] }))
        .catch(e => setErr(e.message))
        .finally(() => setLoading(false));
    } else {
      setAccess({ roles: [], permissions: [] });
    }
  }, [effectiveUserId, localTeamId]);

  return (
    <div className="split-layout">
      <div className="split-main">
        <div className="panel-header">
          <h2>{isAdmin ? 'Access Matrix' : 'My Access'}</h2>
          {loading && <span className="perm-note">Loading…</span>}
        </div>

        {err && <div className="alert-bar" role="alert"><span>{err}</span></div>}

        <div className="kv-list">
          <div className="kv-row">
            <span>User</span>
            <strong>{selectedUser ? selectedUser.name : '—'}</strong>
          </div>
          <div className="kv-row">
            <span>Team</span>
            <strong>{selectedTeam ? selectedTeam.name : '—'}</strong>
          </div>
        </div>

        <div className="stats-row compact">
          <div className="stat-tile"><strong>{access.roles.length}</strong><span>Resolved roles</span></div>
          <div className="stat-tile"><strong>{access.permissions.length}</strong><span>Resolved permissions</span></div>
          <div className="stat-tile"><strong>{access.roles.length > 0 ? 'Granted' : 'None'}</strong><span>Access state</span></div>
        </div>

        {access.roles.length > 0 && (
          <div className="access-detail">
            <h3>Roles in this team</h3>
            <div className="chip-list">
              {access.roles.map(r => <span key={r._id} className="chip">{r.name}</span>)}
            </div>
          </div>
        )}

        {access.permissions.length > 0 && (
          <div className="access-detail">
            <h3>Effective permissions</h3>
            <div className="perm-cards">
              {access.permissions.map(p => (
                <div key={p._id} className="perm-card">
                  <div className="perm-card-icon"><ShieldIcon /></div>
                  <div className="perm-card-body">
                    <strong>{p.label || p.code}</strong>
                    <span>{p.code}</span>
                    {p.description && <p>{p.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && access.roles.length === 0 && effectiveUserId && localTeamId && (
          <p className="empty-note">
            {isAdmin
              ? 'This user has no roles in the selected team — no permissions resolved.'
              : 'You have no roles in this team — no permissions resolved.'}
          </p>
        )}
        {(!effectiveUserId || !localTeamId) && (
          <p className="empty-note">Select a team to resolve access.</p>
        )}
      </div>

      <div className="split-aside">
        <div className="panel-header"><h2>Select context</h2></div>
        <div className="form-stack">
          {isAdmin && (
            <Field label="User">
              <select value={localUserId} onChange={e => setLocalUserId(e.target.value)}>
                <option value="">Select user</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} — {u.email}</option>)}
              </select>
            </Field>
          )}
          <Field label="Team">
            <select value={localTeamId} onChange={e => setLocalTeamId(e.target.value)}>
              <option value="">Select team</option>
              {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </Field>
        </div>

        {access.permissions.length > 0 && (
          <div className="access-summary-box">
            <p className="access-summary-label">Permission summary</p>
            <div className="chip-list">
              {access.permissions.map(p => (
                <span key={p._id} className="chip chip-sm">{p.code}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────────────────── */
function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <strong className="stat-value">{value}</strong>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function FlowStep({ step, title, desc, done }) {
  return (
    <div className={`flow-step${done ? ' done' : ''}`}>
      <div className="flow-num">{done ? '✓' : step}</div>
      <div className="flow-content">
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function moduleTitle(id) {
  return navigation.find(e => e.id === id)?.label || 'Overview';
}

/* ─────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────── */
function Svg({ children, ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
function MenuIcon()      { return <Svg><line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></Svg>; }
function DashboardIcon() { return <Svg><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Svg>; }
function UsersIcon()     { return <Svg><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87"/></Svg>; }
function TeamIcon()      { return <Svg><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1"/></Svg>; }
function RolesIcon()     { return <Svg><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>; }
function ShieldIcon()    { return <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>; }
function LinkIcon()      { return <Svg><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>; }
function MatrixIcon()    { return <Svg><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="17" y="10" width="4" height="5" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/><rect x="10" y="17" width="5" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/></Svg>; }
function SearchIcon()    { return <Svg width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>; }
function SignOutIcon()   { return <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>; }

export default App;
