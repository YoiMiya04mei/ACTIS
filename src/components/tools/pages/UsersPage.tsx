import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  UserCheck,
  AlertCircle,
  Info,
  Edit3,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  User,
} from 'lucide-react';
import { authService } from '@/services/authService';
import type { UserAccount, UserRole } from '@/types/auth';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';

interface UsersPageProps {
  currentUser: UserAccount;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  onUserChanged?: () => void;
  onCurrentUserUpdated?: (user: UserAccount) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  currentUser,
  addToast,
  onUserChanged,
  onCurrentUserUpdated,
}) => {
  const [userList, setUserList] = useState<UserAccount[]>(authService.getUsers());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Add Form states
  const [newName, setNewName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('password123');
  const [newPosition, setNewPosition] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('engineer');
  const [formError, setFormError] = useState<string>('');

  // Edit Form states
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('engineer');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  const isAdmin = currentUser.role === 'admin';

  const refreshUsers = () => {
    const list = authService.getUsers();
    setUserList(list);
    if (onUserChanged) onUserChanged();
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword('');
    setEditPosition(user.position);
    setEditRole(user.role);
    setShowEditPassword(false);
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editingUser) return;

    if (!editUsername.trim()) {
      setEditError('Username tidak boleh kosong.');
      return;
    }
    if (!editName.trim()) {
      setEditError('Nama Lengkap tidak boleh kosong.');
      return;
    }

    const res = authService.updateUser(editingUser.id, {
      name: editName,
      username: editUsername,
      role: editRole,
      position: editPosition,
      ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
    });

    if (res.success && res.user) {
      addToast(
        'success',
        'Data Pengguna Diperbarui',
        `Akun @${res.user.username} (${res.user.name}) berhasil diperbarui.${
          editPassword.trim() ? ' Password baru telah aktif.' : ''
        }`
      );

      if (res.user.id === currentUser.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(res.user);
      }

      setEditingUser(null);
      refreshUsers();
    } else {
      setEditError(res.error || 'Gagal memperbarui akun.');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isAdmin) {
      setFormError('Hanya Super Admin yang diizinkan menambahkan akun baru.');
      return;
    }

    const res = authService.addUser({
      name: newName,
      username: newUsername,
      password: newPassword,
      position: newPosition,
      role: newRole,
    });

    if (res.success && res.user) {
      addToast(
        'success',
        'Akun Berhasil Ditambahkan',
        `User @${res.user.username} (${res.user.name}) siap digunakan untuk membuat RFO.`
      );
      setShowAddModal(false);
      setNewName('');
      setNewUsername('');
      setNewPassword('password123');
      setNewPosition('');
      setNewRole('engineer');
      refreshUsers();
    } else {
      setFormError(res.error || 'Gagal menambahkan akun.');
    }
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (!isAdmin) {
      addToast('error', 'Akses Ditolak', 'Hanya Super Admin yang dapat menghapus akun.');
      return;
    }

    if (user.id === currentUser.id) {
      addToast('error', 'Tidak Dapat Dihapus', 'Anda tidak dapat menghapus akun yang sedang Anda gunakan.');
      return;
    }

    if (window.confirm(`Yakin ingin menghapus akun @${user.username} (${user.name})?`)) {
      const res = authService.deleteUser(user.id);
      if (res.success) {
        addToast('info', 'Akun Dihapus', `Akun @${user.username} telah dihapus.`);
        refreshUsers();
      } else {
        addToast('error', 'Gagal Menghapus', res.error || 'Terjadi kesalahan.');
      }
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Manajemen Akun Terdaftar & Hak Akses (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Setiap dokumen RFO yang dibuat otomatis mencatat nama dan jabatan pembuatnya di riwayat arsip.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Akun Baru</span>
          </button>
        )}
      </div>

      {/* Role Permission Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => {
          const info = ROLE_LABELS[r];
          const perm = ROLE_PERMISSIONS[r];
          return (
            <div
              key={r}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${info.badgeClass}`}
                  >
                    {info.label}
                  </span>
                  <Shield className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{info.desc}</p>
              </div>

              <div className="border-t border-slate-100 pt-2 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Buat Dokumen RFO</span>
                  {perm.canCreateRFO ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Edit Riwayat RFO</span>
                  {perm.canEditRFO ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Hapus Riwayat RFO</span>
                  {perm.canDeleteRFO ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Kelola Kop Surat & Template</span>
                  {perm.canManageTemplates ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 bg-white">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Daftar Akun Terdaftar ({userList.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Login aktif saat ini:{' '}
            <strong className="text-blue-700 font-semibold">{currentUser.name}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Pengguna & Username</th>
                <th className="py-3 px-4">Jabatan / Posisi</th>
                <th className="py-3 px-4">Hak Akses (Role)</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {userList.map((user) => {
                const badge = ROLE_LABELS[user.role];
                const isCurrent = user.id === currentUser.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${
                            user.avatarColor || 'from-blue-600 to-indigo-600'
                          } flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0`}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{user.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-normal">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {user.position}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${badge.badgeClass}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Aktif Tersedia
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 transition-colors cursor-pointer"
                          title="Edit Username, Password, atau Data Akun"
                        >
                          <Edit3 className="w-4 h-4 text-blue-600" />
                        </button>

                        {isAdmin && !isCurrent ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                            title="Hapus akun ini"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add New User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 sm:space-y-5 animate-scale-up my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Tambah Akun Anggota Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Pembuat RFO
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Dedi Pratama"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold shadow-xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Nama ini yang akan otomatis tersimpan di riwayat RFO saat akun ini membuat dokumen.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="dedi"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="Contoh: NOC Shift Engineer"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Peran & Hak Akses (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold shadow-xs"
                >
                  <option value="engineer">NOC Engineer (Dapat Buat & Kelola RFO)</option>
                  <option value="staff">Customer Support (Dapat Buat RFO Layanan CS)</option>
                  <option value="admin">Super Admin (Akses Penuh Seluruh Modul)</option>
                  <option value="viewer">Auditor / Viewer (Hanya Melihat & Unduh)</option>
                </select>
                <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1 font-semibold text-blue-700 mb-0.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>{ROLE_LABELS[newRole].label}</span>
                  </div>
                  <span>{ROLE_LABELS[newRole].desc}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Simpan Akun Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit User & Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 sm:space-y-5 animate-scale-up my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Pengguna & Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ubah username, password, dan identitas akun
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Pembuat RFO
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Username (Untuk Login)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
                    @
                  </div>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Contoh: budi_noc"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono shadow-xs"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Username unik tanpa spasi untuk masuk ke portal sistem.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password Baru (Opsional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin mengubah password"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Ketik kata sandi baru untuk mengganti password akun ini.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jabatan / Posisi Resmi
                </label>
                <input
                  type="text"
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  placeholder="Contoh: NOC Tier 2 Engineer"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hak Akses (Role)
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  disabled={editingUser.id === currentUser.id && currentUser.role === 'admin'}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold shadow-xs disabled:opacity-60"
                >
                  <option value="engineer">NOC Engineer (Dapat Buat & Kelola RFO)</option>
                  <option value="staff">Customer Support (Dapat Buat RFO Layanan CS)</option>
                  <option value="admin">Super Admin (Akses Penuh Seluruh Modul)</option>
                  <option value="viewer">Auditor / Viewer (Hanya Melihat & Unduh)</option>
                </select>
                {editingUser.id === currentUser.id && currentUser.role === 'admin' ? (
                  <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                    Role akun Anda sendiri dikunci sebagai Super Admin demi keamanan sistem.
                  </span>
                ) : (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1 font-semibold text-blue-700 mb-0.5">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      <span>{ROLE_LABELS[editRole].label}</span>
                    </div>
                    <span>{ROLE_LABELS[editRole].desc}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
