// ─── Local Authentication System (localStorage) ───────────────
// Works in static deployment. Backend-ready for future upgrade.

export interface LocalUser {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: "user" | "admin";
  passwordHash: string; // not used client-side, stored for demo
  createdAt: string;
}

export interface AuthState {
  user: Omit<LocalUser, "passwordHash"> | null;
  token: string | null;
}

const AUTH_KEY = "pulseboost_auth_v1";
const USERS_KEY = "pulseboost_users_v1";
const ADMIN_SEEDED_KEY = "pulseboost_admin_seeded";

// ─── Simple hash for demo (NOT for production) ────────────────
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36) + str.length.toString(36);
}

// ─── User Storage ─────────────────────────────────────────────
export function getAllUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function saveAuth(state: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  // Notify all listeners that auth state changed
  window.dispatchEvent(new Event("localauthchange"));
}

// ─── Seed Admin Account ───────────────────────────────────────
export function seedAdminAccount() {
  if (localStorage.getItem(ADMIN_SEEDED_KEY)) return;

  const users = getAllUsers();
  const adminExists = users.find((u) => u.email === "admin@pulseboost.ai");
  if (!adminExists) {
    users.push({
      id: Date.now(),
      name: "Admin",
      email: "admin@pulseboost.ai",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
      role: "admin",
      passwordHash: simpleHash("admin123456"),
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
  }
  localStorage.setItem(ADMIN_SEEDED_KEY, "1");
}

// ─── Register ─────────────────────────────────────────────────
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  invitationCode?: string;
}

export function registerLocal(input: RegisterInput): { success: boolean; error?: string; user?: Omit<LocalUser, "passwordHash"> } {
  const users = getAllUsers();

  // Check if email exists
  if (users.find((u) => u.email === input.email)) {
    return { success: false, error: "该邮箱已被注册" };
  }

  const newUser: LocalUser = {
    id: Date.now(),
    name: input.name,
    email: input.email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.email)}`,
    role: "user",
    passwordHash: simpleHash(input.password),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // Auto login
  const { passwordHash, ...userWithoutPassword } = newUser;
  const auth: AuthState = { user: userWithoutPassword, token: `token_${newUser.id}` };
  saveAuth(auth);

  return { success: true, user: userWithoutPassword };
}

// ─── Login ────────────────────────────────────────────────────
export interface LoginInput {
  email: string;
  password: string;
}

export function loginLocal(input: LoginInput): { success: boolean; error?: string; user?: Omit<LocalUser, "passwordHash"> } {
  const users = getAllUsers();
  const user = users.find((u) => u.email === input.email);

  if (!user) {
    return { success: false, error: "邮箱或密码错误" };
  }

  if (user.passwordHash !== simpleHash(input.password)) {
    return { success: false, error: "邮箱或密码错误" };
  }

  const { passwordHash, ...userWithoutPassword } = user;
  const auth: AuthState = { user: userWithoutPassword, token: `token_${user.id}` };
  saveAuth(auth);

  return { success: true, user: userWithoutPassword };
}

// ─── Logout ───────────────────────────────────────────────────
export function logoutLocal() {
  localStorage.removeItem(AUTH_KEY);
}

// ─── Get Current User ─────────────────────────────────────────
export function getCurrentUser(): Omit<LocalUser, "passwordHash"> | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const auth: AuthState = JSON.parse(raw);
    return auth.user;
  } catch {
    return null;
  }
}

// ─── Check if Admin ───────────────────────────────────────────
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "admin";
}

// ─── Role Management (Admin Only) ─────────────────────────────

export function setUserRole(userId: number, role: "user" | "admin"): boolean {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return false;

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  users[idx].role = role;
  saveUsers(users);

  // If the modified user is currently logged in, update their auth state too
  const authRaw = localStorage.getItem(AUTH_KEY);
  if (authRaw) {
    try {
      const auth: AuthState = JSON.parse(authRaw);
      if (auth.user?.id === userId) {
        auth.user.role = role;
        saveAuth(auth);
      }
    } catch { /* ignore */ }
  }

  return true;
}

export function removeUserRole(userId: number): boolean {
  // Removing role = setting back to "user"
  return setUserRole(userId, "user");
}

// Admin: list all registered users with their roles
export function listUsersForAdmin(): Array<Omit<LocalUser, "passwordHash">> | null {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return null;
  return getAllUsers().map(({ passwordHash, ...u }) => u);
}

// ─── Get All Users (admin only) ───────────────────────────────
export function getAllRegisteredUsers(): Omit<LocalUser, "passwordHash">[] {
  return getAllUsers().map(({ passwordHash, ...u }) => u);
}
