import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const blankUser = { name: '', email: '', password: '', accountType: 'employee' };
const blankTeam = { name: '', description: '' };
const blankPermission = { code: '', label: '', description: '' };
const blankRole = { name: '', description: '' };

const navigation = [
  { id: 'overview', label: 'Overview', icon: DashboardIcon },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'teams', label: 'Teams', icon: TeamIcon },
  { id: 'roles', label: 'Roles', icon: RolesIcon },
  { id: 'permissions', label: 'Permissions', icon: ShieldIcon },
  { id: 'memberships', label: 'Memberships', icon: LinkIcon },
  { id: 'access', label: 'Access Matrix', icon: MatrixIcon },
];

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('rengy-token');
    const user = localStorage.getItem('rengy-user');

    return {
      token,
      user: user ? JSON.parse(user) : null,
      ready: false,
    };
  });
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState(blankUser);
  const [activeModule, setActiveModule] = useState('overview');
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [effectiveAccess, setEffectiveAccess] = useState({ roles: [], permissions: [] });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedRolePermissionIds, setSelectedRolePermissionIds] = useState([]);
  const [selectedMemberRoleIds, setSelectedMemberRoleIds] = useState([]);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchTeams, setSearchTeams] = useState('');
  const [userForm, setUserForm] = useState(blankUser);
  const [teamForm, setTeamForm] = useState(blankTeam);
  const [permissionForm, setPermissionForm] = useState(blankPermission);
  const [roleForm, setRoleForm] = useState(blankRole);
  const [status, setStatus] = useState('Loading workspace...');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const restore = async () => {
      if (!auth.token) {
        setAuth((current) => ({ ...current, ready: true }));
        return;
      }

      try {
        const result = await api.me();
        const user = result.user;
        localStorage.setItem('rengy-user', JSON.stringify(user));
        setAuth({ token: auth.token, user, ready: true });
      } catch {
        localStorage.removeItem('rengy-token');
        localStorage.removeItem('rengy-user');
        setAuth({ token: null, user: null, ready: true });
      }
    };

    restore();
  }, []);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    loadReferenceData();
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    loadDirectory();
  }, [auth.token, searchUsers, searchTeams]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    } else {
      setTeamMembers([]);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    if (selectedTeamId && selectedUserId) {
      loadEffectiveAccess(selectedTeamId, selectedUserId);
    } else {
      setEffectiveAccess({ roles: [], permissions: [] });
    }
  }, [selectedTeamId, selectedUserId]);

  useEffect(() => {
    if (!selectedRoleId && roles.length) {
      setSelectedRoleId(roles[0]._id);
      setSelectedRolePermissionIds(roles[0].permissions?.map((permission) => permission._id) || []);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId) {
      const role = roles.find((entry) => entry._id === selectedRoleId);
      setSelectedRolePermissionIds(role?.permissions?.map((permission) => permission._id) || []);
    }
  }, [selectedRoleId, roles]);

  useEffect(() => {
    if (selectedTeamId && selectedUserId) {
      const member = teamMembers.find((entry) => entry.user?._id === selectedUserId);
      setSelectedMemberRoleIds(member?.roles?.map((role) => role._id) || []);
    }
  }, [selectedTeamId, selectedUserId, teamMembers]);

  useEffect(() => {
    if (!selectedUserId && users.length) {
      setSelectedUserId(users[0]._id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedTeamId && teams.length) {
      setSelectedTeamId(teams[0]._id);
    }
  }, [teams, selectedTeamId]);

  const isAdmin = auth.user?.accountType === 'admin';

  const moduleList = useMemo(
    () => (isAdmin ? navigation : navigation.filter((entry) => entry.id === 'overview' || entry.id === 'access')),
    [isAdmin]
  );

  async function loadDirectory() {
    try {
      setBusy(true);
      setError('');
      const [userResult, teamResult] = await Promise.all([
        api.getUsers(searchUsers),
        api.getTeams(searchTeams),
      ]);

      setUsers(userResult.items || []);
      setTeams(teamResult.items || []);

      if (!selectedUserId && userResult.items?.length) {
        setSelectedUserId(userResult.items[0]._id);
      }

      if (!selectedTeamId && teamResult.items?.length) {
        setSelectedTeamId(teamResult.items[0]._id);
      }
      setStatus('Directory refreshed');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadReferenceData() {
    try {
      setBusy(true);
      setError('');
      const [permissionResult, roleResult] = await Promise.all([api.getPermissions(), api.getRoles()]);
      setPermissions(permissionResult.items || []);
      setRoles(roleResult.items || []);
      setStatus('RBAC catalog loaded');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadTeamMembers(teamId) {
    try {
      const result = await api.getTeamMembers(teamId);
      setTeamMembers(result.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadEffectiveAccess(teamId, userId) {
    try {
      const result = await api.getUserPermissionsInTeam(teamId, userId);
      setEffectiveAccess({
        roles: result.roles || [],
        permissions: result.permissions || [],
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setError('');

      const payload =
        authMode === 'signin'
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
              accountType: 'employee',
            };

      const result = authMode === 'signin' ? await api.signIn(payload) : await api.signUp(payload);

      localStorage.setItem('rengy-token', result.token);
      localStorage.setItem('rengy-user', JSON.stringify(result.user));
      setAuth({ token: result.token, user: result.user, ready: true });
      setStatus('Authenticated');
      setAuthForm(blankUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('rengy-token');
    localStorage.removeItem('rengy-user');
    setAuth({ token: null, user: null, ready: true });
    setActiveModule('overview');
    setStatus('Logged out');
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    try {
      setBusy(true);
      await api.createUser(userForm);
      setUserForm(blankUser);
      await loadDirectory();
      setStatus('User created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault();
    try {
      setBusy(true);
      await api.createTeam(teamForm);
      setTeamForm(blankTeam);
      await loadDirectory();
      setStatus('Team created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePermission(event) {
    event.preventDefault();
    try {
      setBusy(true);
      await api.createPermission(permissionForm);
      setPermissionForm(blankPermission);
      await loadReferenceData();
      setStatus('Permission created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    try {
      setBusy(true);
      await api.createRole(roleForm);
      setRoleForm(blankRole);
      await loadReferenceData();
      setStatus('Role created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignPermissionsToRole(event) {
    event.preventDefault();

    if (!selectedRoleId) {
      setError('Pick a role first');
      return;
    }

    try {
      setBusy(true);
      await api.setRolePermissions(selectedRoleId, selectedRolePermissionIds);
      await loadReferenceData();
      await loadTeamMembers(selectedTeamId);
      setStatus('Role permissions updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignMember(event) {
    event.preventDefault();

    if (!selectedUserId || !selectedTeamId) {
      setError('Select both a user and a team');
      return;
    }

    try {
      setBusy(true);
      await api.addUserToTeam(selectedTeamId, { userId: selectedUserId, roleIds: selectedMemberRoleIds });
      await loadTeamMembers(selectedTeamId);
      await loadEffectiveAccess(selectedTeamId, selectedUserId);
      setStatus('Membership updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId) {
    try {
      setBusy(true);
      await api.removeUserFromTeam(selectedTeamId, userId);
      await loadTeamMembers(selectedTeamId);
      setSelectedMemberRoleIds([]);
      if (selectedUserId === userId) {
        setEffectiveAccess({ roles: [], permissions: [] });
      }
      setStatus('Member removed');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!auth.ready) {
    return <AuthLoading />;
  }

  if (!auth.user) {
    return (
      <AuthPage
        mode={authMode}
        setMode={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        onSubmit={handleAuthSubmit}
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <div className={sidebarCollapsed ? 'enterprise-shell collapsed' : 'enterprise-shell'}>
      <aside className="sidebar card">
        <div className="brand-block">
          <div className="brand-mark">RB</div>
          <div className="brand-copy">
            <strong>Rengy RBAC</strong>
            <p>Enterprise control plane</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {moduleList.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={activeModule === entry.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveModule(entry.id)}
              title={entry.label}
              aria-label={entry.label}
            >
              <entry.icon />
              <span className="label">{entry.label}</span>
            </button>
          ))}
        </nav>

        <div className="session-card">
          <span className="session-badge">{auth.user.accountType}</span>
          <strong>{auth.user.name}</strong>
          <p>{auth.user.email}</p>
          <button type="button" className="ghost-button full-width" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar card">
          <div className="topbar-leading">
            <button
              type="button"
              className="ghost-button sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            >
              <MenuIcon />
            </button>
            <div>
              <p className="eyebrow">Authenticated workspace</p>
              <h1>{moduleTitle(activeModule)}</h1>
            </div>
          </div>
          <div className="topbar-meta">
            <span>{status}</span>
            <span>{isAdmin ? 'Admin access' : 'Employee access'}</span>
          </div>
        </header>

        {error ? <section className="alert card">{error}</section> : null}

        <div className="card">
          {activeModule === 'overview' ? (
            <OverviewPanel
              users={users}
              teams={teams}
              permissions={permissions}
              roles={roles}
              user={auth.user}
              selectedUser={users.find((user) => user._id === selectedUserId)}
              selectedTeam={teams.find((team) => team._id === selectedTeamId)}
              effectiveAccess={effectiveAccess}
            />
          ) : null}

          {activeModule === 'users' ? (
            <UsersPanel
              users={users}
              searchUsers={searchUsers}
              setSearchUsers={setSearchUsers}
              userForm={userForm}
              setUserForm={setUserForm}
              onCreateUser={handleCreateUser}
              busy={busy}
              isAdmin={isAdmin}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
            />
          ) : null}

          {activeModule === 'teams' ? (
            <TeamsPanel
              teams={teams}
              searchTeams={searchTeams}
              setSearchTeams={setSearchTeams}
              teamForm={teamForm}
              setTeamForm={setTeamForm}
              onCreateTeam={handleCreateTeam}
              busy={busy}
              isAdmin={isAdmin}
              selectedTeamId={selectedTeamId}
              setSelectedTeamId={setSelectedTeamId}
            />
          ) : null}

          {activeModule === 'roles' ? (
            <RolesPanel
              roles={roles}
              permissions={permissions}
              roleForm={roleForm}
              setRoleForm={setRoleForm}
              onCreateRole={handleCreateRole}
              selectedRoleId={selectedRoleId}
              setSelectedRoleId={setSelectedRoleId}
              selectedRolePermissionIds={selectedRolePermissionIds}
              setSelectedRolePermissionIds={setSelectedRolePermissionIds}
              onSaveRolePermissions={handleAssignPermissionsToRole}
              busy={busy}
              isAdmin={isAdmin}
            />
          ) : null}

          {activeModule === 'permissions' ? (
            <PermissionsPanel
              permissions={permissions}
              permissionForm={permissionForm}
              setPermissionForm={setPermissionForm}
              onCreatePermission={handleCreatePermission}
              busy={busy}
              isAdmin={isAdmin}
            />
          ) : null}

          {activeModule === 'memberships' ? (
            <MembershipsPanel
              users={users}
              teams={teams}
              roles={roles}
              teamMembers={teamMembers}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
              selectedTeamId={selectedTeamId}
              setSelectedTeamId={setSelectedTeamId}
              selectedMemberRoleIds={selectedMemberRoleIds}
              setSelectedMemberRoleIds={setSelectedMemberRoleIds}
              onSaveMembership={handleAssignMember}
              onRemoveMember={handleRemoveMember}
              busy={busy}
              isAdmin={isAdmin}
            />
          ) : null}

          {activeModule === 'access' ? (
            <AccessPanel
              users={users}
              teams={teams}
              selectedUserId={selectedUserId}
              setSelectedUserId={setSelectedUserId}
              selectedTeamId={selectedTeamId}
              setSelectedTeamId={setSelectedTeamId}
              selectedUser={users.find((user) => user._id === selectedUserId)}
              selectedTeam={teams.find((team) => team._id === selectedTeamId)}
              effectiveAccess={effectiveAccess}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function AuthLoading() {
  return <div className="auth-loading">Loading workspace...</div>;
}

function AuthPage({ mode, setMode, form, setForm, onSubmit, busy, error }) {
  return (
    <div className="auth-shell">
      <section className="auth-hero card">
        <div className="eyebrow-row">
          <p className="eyebrow">Enterprise RBAC</p>
          <span className="status-pill">JWT enabled</span>
        </div>
        <h1>Team management with clean role-based access</h1>
        <p>
          Sign in once and manage teams, users, roles, memberships, and effective permissions from a single minimal workspace.
        </p>
        <div className="feature-row">
          <span className="feature-chip">Users</span>
          <span className="feature-chip">Teams</span>
          <span className="feature-chip">Roles</span>
          <span className="feature-chip">Permissions</span>
          <span className="feature-chip">Access Matrix</span>
        </div>
      </section>

      <section className="auth-panel card">
        <div className="auth-toggle">
          <button type="button" className={mode === 'signin' ? 'toggle active' : 'toggle'} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button type="button" className={mode === 'signup' ? 'toggle active' : 'toggle'} onClick={() => setMode('signup')}>
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === 'signup' ? (
            <Field label="Name">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
          ) : null}

          <Field label="Email">
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </Field>

          <Field label="Password">
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </Field>

          <button type="submit" className="primary-button full-width" disabled={busy}>
            {mode === 'signin' ? 'Enter workspace' : 'Create employee account'}
          </button>
        </form>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="hint-box">
          <strong>Admin sign-in</strong>
          <p>Use the seeded admin mail and password from the server env file.</p>
        </div>
      </section>
    </div>
  );
}

function OverviewPanel({ users, teams, permissions, roles, user, selectedUser, selectedTeam, effectiveAccess }) {
  return (
    <section className="overview-grid">
      <section className="overview-hero card">
        <div className="overview-hero-head">
          <div>
            <p className="eyebrow">RBAC snapshot</p>
            <h2>Workspace at a glance</h2>
          </div>
          <div className="overview-context">
            <span>{user.accountType}</span>
            <strong>{user.name}</strong>
          </div>
        </div>

        <div className="overview-stats">
          <StatCard label="Users" value={users.length} tone="olive" />
          <StatCard label="Teams" value={teams.length} tone="deep" />
          <StatCard label="Roles" value={roles.length} tone="moss" />
          <StatCard label="Permissions" value={permissions.length} tone="gold" />
        </div>

        <div className="overview-flow">
          <FlowStep step="1" title="Pick user" text={selectedUser ? selectedUser.name : 'Choose a user from the list'} />
          <FlowStep step="2" title="Pick team" text={selectedTeam ? selectedTeam.name : 'Choose a team for this user'} />
          <FlowStep step="3" title="Resolve access" text={`${effectiveAccess.permissions.length} effective permissions`} />
        </div>
      </section>

      <section className="overview-side">
        <div className="card panel visual-panel">
          <h2>Current context</h2>
          <div className="context-summary">
            <div>
              <span>Selected user</span>
              <strong>{selectedUser ? selectedUser.name : 'None'}</strong>
            </div>
            <div>
              <span>Selected team</span>
              <strong>{selectedTeam ? selectedTeam.name : 'None'}</strong>
            </div>
          </div>
        </div>

        <div className="card panel visual-panel">
          <h2>Effective access</h2>
          <div className="mini-metrics">
            <div className="mini-metric">
              <span>Roles</span>
              <strong>{effectiveAccess.roles.length}</strong>
            </div>
            <div className="mini-metric">
              <span>Permissions</span>
              <strong>{effectiveAccess.permissions.length}</strong>
            </div>
          </div>
          <div className="pill-list">
            {effectiveAccess.permissions.length ? (
              effectiveAccess.permissions.slice(0, 5).map((permission) => (
                <span key={permission._id} className="pill">
                  {permission.code}
                </span>
              ))
            ) : (
              <span className="pill muted">No permissions resolved</span>
            )}
          </div>
        </div>

        <div className="card panel visual-panel">
          <h2>Capabilities</h2>
          <div className="feature-row compact">
            <span className="feature-chip">Create users</span>
            <span className="feature-chip">Create teams</span>
            <span className="feature-chip">Assign roles</span>
            <span className="feature-chip">Assign permissions</span>
          </div>
        </div>
      </section>
    </section>
  );
}

function UsersPanel({ users, searchUsers, setSearchUsers, userForm, setUserForm, onCreateUser, busy, isAdmin, selectedUserId, setSelectedUserId }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <Field label="Search users">
          <input value={searchUsers} onChange={(event) => setSearchUsers(event.target.value)} placeholder="Jane, jane@company.com" />
        </Field>
        <div className="list selection-list">
          {users.map((user) => (
            <button
              key={user._id}
              type="button"
              className={user._id === selectedUserId ? 'list-item active' : 'list-item'}
              onClick={() => setSelectedUserId(user._id)}
            >
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-content">
        <form className="form-grid" onSubmit={onCreateUser}>
          <Field label="Name">
            <input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required disabled={!isAdmin} />
          </Field>
          <Field label="Email">
            <input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required disabled={!isAdmin} />
          </Field>
          <Field label="Temporary Password">
            <input type="text" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder="Optional, defaults to server temp password" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="primary-button" disabled={busy || !isAdmin}>
            Create user
          </button>
        </form>
      </div>
    </section>
  );
}

function TeamsPanel({ teams, searchTeams, setSearchTeams, teamForm, setTeamForm, onCreateTeam, busy, isAdmin, selectedTeamId, setSelectedTeamId }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <Field label="Search teams">
          <input value={searchTeams} onChange={(event) => setSearchTeams(event.target.value)} placeholder="Alpha, Product, QA" />
        </Field>
        <div className="list selection-list">
          {teams.map((team) => (
            <button
              key={team._id}
              type="button"
              className={team._id === selectedTeamId ? 'list-item active' : 'list-item'}
              onClick={() => setSelectedTeamId(team._id)}
            >
              <strong>{team.name}</strong>
              <span>{team.description || 'No description'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-content">
        <form className="form-grid" onSubmit={onCreateTeam}>
          <Field label="Team name">
            <input value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} disabled={!isAdmin} />
          </Field>
          <button type="submit" className="primary-button" disabled={busy || !isAdmin}>
            Create team
          </button>
        </form>
      </div>
    </section>
  );
}

function RolesPanel({ roles, permissions, roleForm, setRoleForm, onCreateRole, selectedRoleId, setSelectedRoleId, selectedRolePermissionIds, setSelectedRolePermissionIds, onSaveRolePermissions, busy, isAdmin }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <div className="list compact-list">
          {roles.map((role) => (
            <button key={role._id} type="button" className={role._id === selectedRoleId ? 'list-item active' : 'list-item'} onClick={() => setSelectedRoleId(role._id)}>
              <strong>{role.name}</strong>
              <span>{role.permissions?.length || 0} permissions</span>
            </button>
          ))}
        </div>
        <div className="checkbox-grid">
          {permissions.map((permission) => (
            <label key={permission._id} className="checkbox-pill">
              <input
                type="checkbox"
                checked={selectedRolePermissionIds.includes(permission._id)}
                onChange={(event) => {
                  setSelectedRolePermissionIds((current) =>
                    event.target.checked ? [...current, permission._id] : current.filter((id) => id !== permission._id)
                  );
                }}
                disabled={!isAdmin}
              />
              <span>{permission.code}</span>
            </label>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={onSaveRolePermissions} disabled={busy || !isAdmin}>
          Save role permissions
        </button>
      </div>

      <div className="sidebar-content">
        <form className="form-grid" onSubmit={onCreateRole}>
          <Field label="Role name">
            <input value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="Admin" required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} placeholder="Team administrator" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="primary-button" disabled={busy || !isAdmin}>
            Create role
          </button>
        </form>
      </div>
    </section>
  );
}

function PermissionsPanel({ permissions, permissionForm, setPermissionForm, onCreatePermission, busy, isAdmin }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <div className="pill-list">
          {permissions.map((permission) => (
            <span key={permission._id} className="pill">
              {permission.code}
            </span>
          ))}
        </div>
      </div>
      <div className="sidebar-content">
        <form className="form-grid" onSubmit={onCreatePermission}>
          <Field label="Code">
            <input value={permissionForm.code} onChange={(event) => setPermissionForm({ ...permissionForm, code: event.target.value })} placeholder="CREATE_TASK" required disabled={!isAdmin} />
          </Field>
          <Field label="Label">
            <input value={permissionForm.label} onChange={(event) => setPermissionForm({ ...permissionForm, label: event.target.value })} placeholder="Create Task" required disabled={!isAdmin} />
          </Field>
          <Field label="Description">
            <input value={permissionForm.description} onChange={(event) => setPermissionForm({ ...permissionForm, description: event.target.value })} placeholder="Allows creating tasks" disabled={!isAdmin} />
          </Field>
          <button type="submit" className="primary-button" disabled={busy || !isAdmin}>
            Create permission
          </button>
        </form>
      </div>
    </section>
  );
}

function MembershipsPanel({ users, teams, roles, teamMembers, selectedUserId, setSelectedUserId, selectedTeamId, setSelectedTeamId, selectedMemberRoleIds, setSelectedMemberRoleIds, onSaveMembership, onRemoveMember, busy, isAdmin }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <div className="list compact-list">
          {teams.map((team) => (
            <div key={team._id} className="list-item">
              <div className="list-item-header">
                <div className="list-item-title">{team.name}</div>
                <div className="list-item-actions">
                  <button className="link-button" onClick={() => setSelectedTeamId(team._id)} disabled={!isAdmin}>
                    Manage
                  </button>
                </div>
              </div>
              <div className="pill-list">
                {(teamMembers[team._id] || []).map((member) => (
                  <span key={member.user._id} className="pill">
                    {member.user.name}
                    <button onClick={() => onRemoveMember(team._id, member.user._id)} disabled={!isAdmin}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sidebar-content">
        <form className="form-grid" onSubmit={onSaveMembership}>
          <Field label="Selected user">
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required disabled={!isAdmin}>
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Selected team">
            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} required disabled={!isAdmin}>
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Roles">
            <div className="checkbox-group">
              {roles.map((role) => (
                <label key={role._id}>
                  <input
                    type="checkbox"
                    value={role._id}
                    checked={selectedMemberRoleIds.includes(role._id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedMemberRoleIds([...selectedMemberRoleIds, role._id]);
                      } else {
                        setSelectedMemberRoleIds(selectedMemberRoleIds.filter((id) => id !== role._id));
                      }
                    }}
                    disabled={!isAdmin}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </Field>
          <button type="submit" className="primary-button" disabled={busy || !isAdmin}>
            Save membership
          </button>
        </form>
      </div>
    </section>
  );
}

function AccessPanel({ users, teams, selectedUserId, setSelectedUserId, selectedTeamId, setSelectedTeamId, selectedUser, selectedTeam, effectiveAccess }) {
  return (
    <section className="module-layout">
      <div className="primary-content">
        <div className="matrix-selectors">
          <Field label="User">
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team">
            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="context-line">
          <span>{selectedUser ? selectedUser.name : 'No user selected'}</span>
          <span>{selectedTeam ? selectedTeam.name : 'No team selected'}</span>
        </div>

        <div className="access-summary-grid">
          <div className="summary-tile">
            <span>Resolved roles</span>
            <strong>{effectiveAccess.roles.length}</strong>
          </div>
          <div className="summary-tile">
            <span>Resolved permissions</span>
            <strong>{effectiveAccess.permissions.length}</strong>
          </div>
          <div className="summary-tile">
            <span>Access state</span>
            <strong>{effectiveAccess.roles.length ? 'Granted' : 'None'}</strong>
          </div>
        </div>
      </div>
      <div className="sidebar-content">
        <div className="info-stack">
          <div className="summary-tile">
            <span>Current user</span>
            <strong>{selectedUser ? selectedUser.name : 'None'}</strong>
          </div>
          <div className="summary-tile">
            <span>Current team</span>
            <strong>{selectedTeam ? selectedTeam.name : 'None'}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function moduleTitle(id) {
  return navigation.find((entry) => entry.id === id)?.label || 'Overview';
}

function StatCard({ label, value, tone }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FlowStep({ step, title, text }) {
  return (
    <article className="flow-step">
      <span className="flow-step-number">{step}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="card panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DashboardIcon() {
  return <IconPath d="M4 12h6V4H4zm10 8h6v-6h-6zM14 20h6v-8h-6zM4 20h6v-4H4z" />;
}

function UsersIcon() {
  return <IconPath d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1Z" />;
}

function TeamIcon() {
  return <IconPath d="M7 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm10 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM4 20v-1a4 4 0 0 1 4-4h2m10 5v-1a4 4 0 0 0-4-4h-2" />;
}

function RolesIcon() {
  return <IconPath d="M12 3l3.2 6.5L22 11l-5 4.8L18.2 23 12 19.4 5.8 23 7 15.8 2 11l6.8-1.5Z" />;
}

function ShieldIcon() {
  return <IconPath d="M12 2l8 3v6c0 5.2-3.4 9.9-8 11-4.6-1.1-8-5.8-8-11V5Z" />;
}

function LinkIcon() {
  return <IconPath d="M10 14a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1m-6 2-1 1a4 4 0 1 1-6-6l2-2" />;
}

function MatrixIcon() {
  return <IconPath d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" />;
}

function IconPath({ d }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

export default App;