import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://127.0.0.1:27017/rengy_rbac';

const User       = mongoose.model('User',       new mongoose.Schema({ name: String, email: String, accountType: String }, { strict: false }));
const Team       = mongoose.model('Team',       new mongoose.Schema({ name: String, description: String }, { strict: false }));
const Role       = mongoose.model('Role',       new mongoose.Schema({ name: String, permissions: [mongoose.Schema.Types.ObjectId] }, { strict: false }));
const Permission = mongoose.model('Permission', new mongoose.Schema({ code: String, label: String }, { strict: false }));
const Membership = mongoose.model('Membership', new mongoose.Schema({ user: mongoose.Schema.Types.ObjectId, team: mongoose.Schema.Types.ObjectId, roles: [mongoose.Schema.Types.ObjectId] }, { strict: false }));

try {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const [users, teams, roles, perms, memberships] = await Promise.all([
    User.find(),
    Team.find(),
    Role.find(),
    Permission.find(),
    Membership.find(),
  ]);

  console.log(`USERS (${users.length}):`);
  users.forEach(u => console.log(`  - ${u.name} <${u.email}> [${u.accountType}]`));

  console.log(`\nTEAMS (${teams.length}):`);
  teams.forEach(t => console.log(`  - ${t.name}: ${t.description}`));

  console.log(`\nPERMISSIONS (${perms.length}):`);
  perms.forEach(p => console.log(`  - ${p.code}: ${p.label}`));

  console.log(`\nROLES (${roles.length}):`);
  roles.forEach(r => console.log(`  - ${r.name} (${r.permissions.length} permissions)`));

  console.log(`\nMEMBERSHIPS (${memberships.length}):`);
  for (const m of memberships) {
    const u = users.find(x => String(x._id) === String(m.user));
    const t = teams.find(x => String(x._id) === String(m.team));
    const rs = m.roles.map(rid => roles.find(x => String(x._id) === String(rid))?.name || rid).join(', ');
    console.log(`  - ${u?.name || m.user} → ${t?.name || m.team} [${rs}]`);
  }

} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await mongoose.disconnect();
}
