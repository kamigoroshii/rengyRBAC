const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('rengy-token');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

export const api = {
  signIn: (body) => request('/auth/signin', { method: 'POST', body: JSON.stringify(body) }),
  signUp: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  getUsers: (search = '') => request(`/users?search=${encodeURIComponent(search)}`),
  createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  getTeams: (search = '') => request(`/teams?search=${encodeURIComponent(search)}`),
  createTeam: (body) => request('/teams', { method: 'POST', body: JSON.stringify(body) }),
  getPermissions: (search = '') => request(`/permissions?search=${encodeURIComponent(search)}`),
  createPermission: (body) => request('/permissions', { method: 'POST', body: JSON.stringify(body) }),
  getRoles: (search = '') => request(`/roles?search=${encodeURIComponent(search)}`),
  createRole: (body) => request('/roles', { method: 'POST', body: JSON.stringify(body) }),
  setRolePermissions: (roleId, permissionIds) =>
    request(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
    }),
  addUserToTeam: (teamId, body) =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  removeUserFromTeam: (teamId, userId) => request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  updateUserRolesInTeam: (teamId, userId, roleIds) =>
    request(`/teams/${teamId}/members/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    }),
  getTeamMembers: (teamId) => request(`/teams/${teamId}/members`),
  getUserPermissionsInTeam: (teamId, userId) => request(`/teams/${teamId}/users/${userId}/permissions`),
};
