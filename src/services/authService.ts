import type { UserAccount, UserRole, RolePermissions } from '../types/auth';
import { ROLE_PERMISSIONS } from '../types/auth';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  USERS: 'jdp_rfo_users_v1',
  CURRENT_USER: 'jdp_rfo_session_v1',
};

// Default registered accounts
export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr-admin-01',
    username: 'admin',
    name: 'Reza Pahlawan',
    role: 'admin',
    position: 'Sect. Head Customer Service',
    avatarColor: 'from-purple-600 to-indigo-600',
    password: 'password123',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'usr-noc-02',
    username: 'noc',
    name: 'Budi Santoso',
    role: 'engineer',
    position: 'NOC Lead Engineer',
    avatarColor: 'from-cyan-600 to-blue-600',
    password: 'password123',
    createdAt: '2026-10-02T09:00:00.000Z',
  },
  {
    id: 'usr-cs-03',
    username: 'cs',
    name: 'Siti Rahmawati',
    role: 'staff',
    position: 'Customer Service Officer',
    avatarColor: 'from-emerald-600 to-teal-600',
    password: 'password123',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
  {
    id: 'usr-viewer-04',
    username: 'viewer',
    name: 'Ahmad Fauzi',
    role: 'viewer',
    position: 'Operations Auditor',
    avatarColor: 'from-slate-600 to-zinc-600',
    password: 'password123',
    createdAt: '2026-10-04T11:00:00.000Z',
  },
];

class AuthService {
  constructor() {
    this.initDefaultUsers();
  }

  initDefaultUsers(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!existing) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      }
      // Sinkronisasi data user dari Database MySQL di server
      indexedDbStorage.getItem<UserAccount[]>(STORAGE_KEYS.USERS).then((serverUsers) => {
        if (serverUsers && serverUsers.length > 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(serverUsers));
        } else {
          indexedDbStorage.setItem(STORAGE_KEYS.USERS, DEFAULT_USERS).catch(() => {});
        }
      }).catch(() => {});
    } catch (e) {
      console.warn('AuthService storage initialization warning:', e);
    }
  }

  getUsers(): UserAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!raw) return DEFAULT_USERS;
      return JSON.parse(raw) as UserAccount[];
    } catch {
      return DEFAULT_USERS;
    }
  }

  getCurrentUser(): UserAccount | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!raw) return null;
      return JSON.parse(raw) as UserAccount;
    } catch {
      return null;
    }
  }

  login(username: string, password?: string): { success: boolean; user?: UserAccount; error?: string } {
    const users = this.getUsers();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password?.trim();

    const user = users.find(
      (u) => u.username.toLowerCase() === cleanUser || u.name.toLowerCase() === cleanUser
    );

    if (!user) {
      return { success: false, error: 'Username atau nama akun tidak ditemukan.' };
    }

    if (user.password && cleanPass && user.password !== cleanPass) {
      return { success: false, error: 'Password yang Anda masukkan salah.' };
    }

    // Save active session
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to store session:', e);
    }

    return { success: true, user };
  }

  quickLogin(userId: string): UserAccount | null {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (user) {
      try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } catch (e) {
        console.error('Failed to store session:', e);
      }
      return user;
    }
    return null;
  }

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (e) {
      console.error('Failed to remove session:', e);
    }
  }

  addUser(data: {
    username: string;
    name: string;
    role: UserRole;
    position: string;
    password?: string;
  }): { success: boolean; user?: UserAccount; error?: string } {
    const users = this.getUsers();
    const cleanUsername = data.username.trim().toLowerCase();

    if (!cleanUsername) {
      return { success: false, error: 'Username wajib diisi.' };
    }
    if (!data.name.trim()) {
      return { success: false, error: 'Nama Lengkap wajib diisi.' };
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `Username "${cleanUsername}" sudah digunakan.` };
    }

    const colors = [
      'from-purple-600 to-indigo-600',
      'from-cyan-600 to-blue-600',
      'from-emerald-600 to-teal-600',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600',
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: UserAccount = {
      id: `usr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      username: cleanUsername,
      name: data.name.trim(),
      role: data.role,
      position: data.position.trim() || 'Staff Anggota',
      avatarColor,
      password: data.password?.trim() || 'password123',
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      indexedDbStorage.setItem(STORAGE_KEYS.USERS, updated).catch(() => {});
    } catch (e) {
      return { success: false, error: 'Gagal menyimpan ke storage browser.' };
    }

    return { success: true, user: newUser };
  }

  updateUser(
    userId: string,
    data: {
      username?: string;
      name?: string;
      role?: UserRole;
      position?: string;
      password?: string;
    }
  ): { success: boolean; user?: UserAccount; error?: string } {
    const users = this.getUsers();
    const targetIndex = users.findIndex((u) => u.id === userId);

    if (targetIndex === -1) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    const currentTarget = users[targetIndex];

    // Check username uniqueness if changed
    if (data.username !== undefined) {
      const cleanUsername = data.username.trim().toLowerCase();
      if (!cleanUsername) {
        return { success: false, error: 'Username tidak boleh kosong.' };
      }

      const duplicate = users.some(
        (u) => u.id !== userId && u.username.toLowerCase() === cleanUsername
      );
      if (duplicate) {
        return { success: false, error: `Username "${cleanUsername}" sudah digunakan oleh akun lain.` };
      }
    }

    if (data.name !== undefined && !data.name.trim()) {
      return { success: false, error: 'Nama Lengkap tidak boleh kosong.' };
    }

    const updatedUser: UserAccount = {
      ...currentTarget,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.username !== undefined ? { username: data.username.trim().toLowerCase() } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.position !== undefined ? { position: data.position.trim() } : {}),
      ...(data.password !== undefined && data.password.trim() ? { password: data.password.trim() } : {}),
    };

    const newUsers = [...users];
    newUsers[targetIndex] = updatedUser;

    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
      indexedDbStorage.setItem(STORAGE_KEYS.USERS, newUsers).catch(() => {});

      // If updating currently logged in user, update session as well
      const currentSession = this.getCurrentUser();
      if (currentSession && currentSession.id === userId) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      }

      return { success: true, user: updatedUser };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Gagal memperbarui data pengguna ke storage.' };
    }
  }

  deleteUser(userId: string): { success: boolean; error?: string } {
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      return { success: false, error: 'Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.' };
    }

    const users = this.getUsers();
    const updated = users.filter((u) => u.id !== userId);

    if (updated.length === users.length) {
      return { success: false, error: 'Akun tidak ditemukan.' };
    }

    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      indexedDbStorage.setItem(STORAGE_KEYS.USERS, updated).catch(() => {});
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Gagal memperbarui data user.' };
    }
  }

  hasPermission(role: UserRole | undefined, permission: keyof RolePermissions): boolean {
    if (!role) return false;
    return Boolean(ROLE_PERMISSIONS[role]?.[permission]);
  }
}

export const authService = new AuthService();
