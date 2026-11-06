"use client";

import React, { useState, useEffect } from "react";
import { useCurrentUser } from "@/context/UserContext";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  Mail,
  User,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  ShieldAlert,
  Calendar,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Pencil,
  Server,
  Plus,
  Network,
  Radio,
} from "lucide-react";
import {
  DEFAULT_SERVER_OPTIONS,
  DEFAULT_INFRASTRUCTURE_OPTIONS,
  DEFAULT_MEDIA_OPTIONS,
} from "@/lib/ticketUtils";

export default function UserSettingsPage() {
  const { currentUser, users, addUser, updateUser, deleteUser, changePassword, fetchUsers } = useCurrentUser();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("noc_engineer");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Edit User Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editNama, setEditNama] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("noc_engineer");
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Delete User Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Change Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const isAdmin = currentUser?.role === "admin";

  // Server Management State (Admin only)
  const [serverList, setServerList] = useState<string[]>(DEFAULT_SERVER_OPTIONS);
  const [newServerName, setNewServerName] = useState("");
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const loadServerSettings = async () => {
      try {
        const saved = localStorage.getItem("actis_server_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setServerList(Array.from(new Set([...DEFAULT_SERVER_OPTIONS, ...parsed])));
          }
        }
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.server_options) {
          const remoteList = JSON.parse(json.data.server_options);
          if (Array.isArray(remoteList)) {
            setServerList((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Failed to load server options:", e);
      }
    };
    loadServerSettings();
  }, []);

  // Infrastructure Management State (Admin only)
  const [infraList, setInfraList] = useState<string[]>(DEFAULT_INFRASTRUCTURE_OPTIONS);
  const [newInfraName, setNewInfraName] = useState("");
  const [infraSuccess, setInfraSuccess] = useState<string | null>(null);
  const [infraError, setInfraError] = useState<string | null>(null);

  useEffect(() => {
    const loadInfraSettings = async () => {
      try {
        const saved = localStorage.getItem("actis_infrastructure_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInfraList(Array.from(new Set([...DEFAULT_INFRASTRUCTURE_OPTIONS, ...parsed])));
          }
        }
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.infrastructure_options) {
          const remoteList = JSON.parse(json.data.infrastructure_options);
          if (Array.isArray(remoteList)) {
            setInfraList((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Failed to load infrastructure options:", e);
      }
    };
    loadInfraSettings();
  }, []);

  const handleAdminAddInfra = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfraError(null);
    setInfraSuccess(null);
    const trimmed = newInfraName.trim();
    if (!trimmed) {
      setInfraError("Nama infrastruktur tidak boleh kosong.");
      return;
    }
    if (infraList.includes(trimmed)) {
      setInfraError(`Infrastruktur '${trimmed}' sudah ada dalam daftar.`);
      return;
    }
    const updated = [...infraList, trimmed];
    setInfraList(updated);
    setNewInfraName("");
    try {
      localStorage.setItem("actis_infrastructure_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "infrastructure_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setInfraError(data.error || "Gagal menyimpan infrastruktur.");
      } else {
        setInfraSuccess(`Infrastruktur '${trimmed}' berhasil ditambahkan ke pilihan.`);
        setTimeout(() => setInfraSuccess(null), 2500);
      }
    } catch (err: any) {
      setInfraError(err.message || "Gagal menyimpan infrastruktur.");
    }
  };

  const handleAdminDeleteInfra = async (infraToDelete: string) => {
    const updated = infraList.filter((i) => i !== infraToDelete);
    setInfraList(updated);
    try {
      localStorage.setItem("actis_infrastructure_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "infrastructure_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setInfraError(data.error || "Gagal menghapus infrastruktur.");
      } else {
        setInfraSuccess(`Infrastruktur '${infraToDelete}' berhasil dihapus.`);
        setTimeout(() => setInfraSuccess(null), 2500);
      }
    } catch (err: any) {
      setInfraError(err.message || "Gagal menghapus infrastruktur.");
    }
  };

  // Media Koneksi Management State (Admin only)
  const [mediaList, setMediaList] = useState<string[]>(DEFAULT_MEDIA_OPTIONS);
  const [newMediaName, setNewMediaName] = useState("");
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    const loadMediaSettings = async () => {
      try {
        const saved = localStorage.getItem("actis_media_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMediaList(Array.from(new Set([...DEFAULT_MEDIA_OPTIONS, ...parsed])));
          }
        }
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.media_options) {
          const remoteList = JSON.parse(json.data.media_options);
          if (Array.isArray(remoteList)) {
            setMediaList((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Failed to load media options:", e);
      }
    };
    loadMediaSettings();
  }, []);

  const handleAdminAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMediaError(null);
    setMediaSuccess(null);
    const trimmed = newMediaName.trim();
    if (!trimmed) {
      setMediaError("Nama media koneksi tidak boleh kosong.");
      return;
    }
    if (mediaList.includes(trimmed)) {
      setMediaError(`Media koneksi '${trimmed}' sudah ada dalam daftar.`);
      return;
    }
    const updated = [...mediaList, trimmed];
    setMediaList(updated);
    setNewMediaName("");
    try {
      localStorage.setItem("actis_media_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "media_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMediaError(data.error || "Gagal menyimpan media koneksi.");
      } else {
        setMediaSuccess(`Media koneksi '${trimmed}' berhasil ditambahkan ke pilihan.`);
        setTimeout(() => setMediaSuccess(null), 2500);
      }
    } catch (err: any) {
      setMediaError(err.message || "Gagal menyimpan media koneksi.");
    }
  };

  const handleAdminDeleteMedia = async (mediaToDelete: string) => {
    const updated = mediaList.filter((m) => m !== mediaToDelete);
    setMediaList(updated);
    try {
      localStorage.setItem("actis_media_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "media_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMediaError(data.error || "Gagal menghapus media koneksi.");
      } else {
        setMediaSuccess(`Media koneksi '${mediaToDelete}' berhasil dihapus.`);
        setTimeout(() => setMediaSuccess(null), 2500);
      }
    } catch (err: any) {
      setMediaError(err.message || "Gagal menghapus media koneksi.");
    }
  };

  const handleAdminAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setServerSuccess(null);
    const trimmed = newServerName.trim();
    if (!trimmed) {
      setServerError("Nama server tidak boleh kosong.");
      return;
    }
    if (serverList.includes(trimmed)) {
      setServerError(`Server '${trimmed}' sudah ada dalam daftar.`);
      return;
    }
    const updated = [...serverList, trimmed];
    setServerList(updated);
    setNewServerName("");
    try {
      localStorage.setItem("actis_server_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "server_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error || "Gagal menyimpan server.");
      } else {
        setServerSuccess(`Server '${trimmed}' berhasil ditambahkan ke pilihan.`);
        setTimeout(() => setServerSuccess(null), 2500);
      }
    } catch (err: any) {
      setServerError(err.message || "Gagal menyimpan server.");
    }
  };

  const handleAdminDeleteServer = async (serverToDelete: string) => {
    const updated = serverList.filter((s) => s !== serverToDelete);
    setServerList(updated);
    try {
      localStorage.setItem("actis_server_options", JSON.stringify(updated));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "server_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error || "Gagal menghapus server.");
      } else {
        setServerSuccess(`Server '${serverToDelete}' berhasil dihapus.`);
        setTimeout(() => setServerSuccess(null), 2500);
      }
    } catch (err: any) {
      setServerError(err.message || "Gagal menghapus server.");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "noc_engineer":
        return "NOC Engineer";
      case "field_engineer":
        return "Field Engineer";
      case "sales_corporate":
        return "Sales Corporate";
      default:
        return role;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "noc_engineer":
        return "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "field_engineer":
        return "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "sales_corporate":
        return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    if (!newNama || !newEmail || !newPassword) {
      setAddError("Nama, email, dan password wajib diisi.");
      return;
    }

    if (newPassword.length < 6) {
      setAddError("Password baru minimal 6 karakter.");
      return;
    }

    setAddLoading(true);
    const res = await addUser({
      nama: newNama,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });
    setAddLoading(false);

    if (!res.success) {
      setAddError(res.error || "Gagal menambah user.");
    } else {
      setAddSuccess(`Pengguna '${newNama}' berhasil ditambahkan.`);
      setNewNama("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("noc_engineer");
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddSuccess(null);
      }, 1200);
    }
  };

  const handleOpenEdit = (user: any) => {
    setEditUserId(user.id);
    setEditNama(user.nama);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword("");
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    if (!editNama || !editEmail) {
      setEditError("Nama dan email wajib diisi.");
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setEditError("Password baru minimal 6 karakter (atau kosongkan jika tidak diubah).");
      return;
    }

    setEditLoading(true);
    const res = await updateUser(editUserId, {
      nama: editNama,
      email: editEmail,
      role: editRole,
      password: editPassword || undefined,
    });
    setEditLoading(false);

    if (!res.success) {
      setEditError(res.error || "Gagal memperbarui data pengguna.");
    } else {
      setEditSuccess(`Data pengguna '${editNama}' berhasil diperbarui.`);
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1000);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteLoading(true);

    const res = await deleteUser(deleteTarget.id);
    setDeleteLoading(false);

    if (!res.success) {
      setDeleteError(res.error || "Gagal menghapus user.");
    } else {
      setDeleteTarget(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword || !newPass || !confirmPass) {
      setPassError("Semua field password wajib diisi.");
      return;
    }

    if (newPass.length < 6) {
      setPassError("Password baru minimal 6 karakter.");
      return;
    }

    if (newPass !== confirmPass) {
      setPassError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setPassLoading(true);
    const res = await changePassword(oldPassword, newPass);
    setPassLoading(false);

    if (!res.success) {
      setPassError(res.error || "Gagal mengubah password.");
    } else {
      setPassSuccess(res.message || "Password berhasil diperbarui!");
      setOldPassword("");
      setNewPass("");
      setConfirmPass("");
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.nama.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>PENGATURAN KEAMANAN & AKSES</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Pengaturan User Akses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manajemen pengguna sistem, verifikasi kredensial, dan kontrol hak akses peran (RBAC).
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAddSuccess(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            + Tambah Pengguna Baru
          </button>
        )}
      </div>

      {/* User Identity Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-md shadow-blue-500/25">
            {currentUser?.nama?.charAt(0) || "U"}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">{currentUser?.nama}</h2>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getRoleBadge(
                  currentUser?.role || ""
                )}`}
              >
                {getRoleLabel(currentUser?.role || "")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{currentUser?.email}</p>
          </div>
        </div>

        {/* Role Privileges Notice */}
        <div className="max-w-md bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
          {isAdmin ? (
            <div className="flex items-start space-x-2 text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Akses Administrator Aktif</p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Anda memiliki otoritas penuh untuk <strong>menambah</strong>, <strong>mengedit</strong>, dan <strong>menghapus</strong> pengguna serta mengelola akun.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Akses Terbatas ({getRoleLabel(currentUser?.role || "")})</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Hanya Administrator yang dapat menambah, mengedit, dan menghapus user. Anda hanya diizinkan untuk <strong>mengganti password</strong> akun Anda.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADMIN ONLY SECTION: User List Table & Management */}
      {isAdmin ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Daftar Pengguna Sistem</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {filteredUsers.length} Akun
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola hak akses dan staf operasional ISP ACTIS.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, email, role..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Nama & Pengguna</th>
                  <th className="px-5 py-3.5">Email Kantor</th>
                  <th className="px-5 py-3.5">Level Akses (Role)</th>
                  <th className="px-5 py-3.5">Hak Akses Sistem</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isUserAdmin = u.role === "admin";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                            {u.nama.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.nama}</span>
                            {isSelf && (
                              <span className="text-[10px] font-extrabold text-blue-600">
                                (Akun Anda Saat Ini)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-medium text-slate-600">
                        {u.email}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {getRoleLabel(u.role)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                            Penuh (Tambah, Edit & Hapus)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-semibold text-slate-400">
                            <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Hanya Ganti Password
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* EDIT BUTTON (ADMINISTRATOR CAN EDIT ANY USER) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                            title="Edit Data Pengguna"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </button>

                          {isSelf ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                              (Anda)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(u);
                              }}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                              title="Hapus Akun Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Tidak ada pengguna yang cocok dengan pencarian "{searchTerm}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Server Management Section (Admin Only) */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Manajemen Pilihan Server / BRAS Aggregator</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {serverList.length} Server
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar server yang muncul pada pilihan registrasi POP Site dan Enterprise Dedicated.
                </p>
              </div>

              {/* Add server inline form */}
              <form onSubmit={handleAdminAddServer} className="flex items-center space-x-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Nama server / lokasi baru..."
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 transition flex-1 sm:w-64"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>
            </div>

            {serverError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {serverSuccess && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{serverSuccess}</span>
              </div>
            )}

            {/* Server Chips List with Delete Buttons */}
            <div className="flex flex-wrap gap-2">
              {serverList.map((srv) => (
                <div
                  key={srv}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs group hover:border-slate-300 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>{srv}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus server "${srv}" dari daftar pilihan?`)) {
                        handleAdminDeleteServer(srv);
                      }
                    }}
                    className="p-0.5 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                    title={`Hapus server ${srv}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Infrastructure Management Section (Admin Only) */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-emerald-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Network className="w-4 h-4 text-emerald-600" />
                  <span>Manajemen Pilihan Infrastruktur</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {infraList.length} Infrastruktur
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar pilihan infrastruktur pada registrasi POP Site (JDP, Mitra, Metronexia, Metro-E, dll).
                </p>
              </div>

              {/* Add infrastructure inline form */}
              <form onSubmit={handleAdminAddInfra} className="flex items-center space-x-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={newInfraName}
                  onChange={(e) => setNewInfraName(e.target.value)}
                  placeholder="Nama infrastruktur baru..."
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 transition flex-1 sm:w-64"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>
            </div>

            {infraError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{infraError}</span>
              </div>
            )}

            {infraSuccess && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{infraSuccess}</span>
              </div>
            )}

            {/* Infrastructure Chips List with Delete Buttons */}
            <div className="flex flex-wrap gap-2">
              {infraList.map((infra) => (
                <div
                  key={infra}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs group hover:border-slate-300 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{infra}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus infrastruktur "${infra}" dari daftar pilihan?`)) {
                        handleAdminDeleteInfra(infra);
                      }
                    }}
                    className="p-0.5 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                    title={`Hapus infrastruktur ${infra}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Media Koneksi Management Section (Admin Only) */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-indigo-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-indigo-600" />
                  <span>Manajemen Pilihan Media Koneksi</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {mediaList.length} Media Koneksi
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar pilihan media koneksi perangkat (SFP, ONT, dll) pada formulir registrasi.
                </p>
              </div>

              {/* Add media inline form */}
              <form onSubmit={handleAdminAddMedia} className="flex items-center space-x-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                  placeholder="Nama media koneksi baru..."
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 transition flex-1 sm:w-64"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>
            </div>

            {mediaError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{mediaError}</span>
              </div>
            )}

            {mediaSuccess && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{mediaSuccess}</span>
              </div>
            )}

            {/* Media Chips List with Delete Buttons */}
            <div className="flex flex-wrap gap-2">
              {mediaList.map((media) => (
                <div
                  key={media}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs group hover:border-slate-300 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>{media}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus media koneksi "${media}" dari daftar pilihan?`)) {
                        handleAdminDeleteMedia(media);
                      }
                    }}
                    className="p-0.5 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                    title={`Hapus media koneksi ${media}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* NON-ADMIN NOTICE: Explaining clearly why user cannot add or delete */
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-950">
                Akses Pengelolaan Akun Terbatas
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Anda saat ini masuk dengan tingkat akses <strong>{getRoleLabel(currentUser?.role || "")}</strong>.
                Berdasarkan aturan keamanan sistem ISP ACTIS, menu untuk <strong>menambah</strong>, <strong>mengedit</strong>, dan <strong>menghapus</strong> pengguna sistem hanya dapat dilakukan oleh akun dengan level akses <strong>Administrator</strong>.
              </p>
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-lg bg-amber-100 text-[11px] font-bold text-amber-900">
                Fitur yang tersedia untuk Anda: Ganti Password Akun Pribadi.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD FORM (Available to ALL levels: Admin & Non-Admin) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs max-w-2xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ganti Password Akun Saya
            </h3>
            <p className="text-xs text-slate-500">
              Perbarui password login untuk akun {currentUser?.email}.
            </p>
          </div>
        </div>

        {passError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passError}</span>
          </div>
        )}

        {passSuccess && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password Saat Ini
            </label>
            <div className="relative">
              <input
                type={showOldPass ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password saat ini (cth: actis123)"
                className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={passLoading}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 shadow-md transition disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
            >
              {passLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Simpan Perubahan Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: TAMBAH PENGGUNA BARU (ADMIN ONLY) */}
      {isAdmin && isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tambah Pengguna Baru
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Akses Administrator ACTIS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            {addSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{addSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Cth: Joko Susilo (NOC Engineer)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Kantor
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="joko.susilo@isp-enterprise.net"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password Awal
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter (cth: actis123)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Level Akses (Peran / Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                >
                  <option value="noc_engineer">NOC Engineer (Hanya Ganti Password)</option>
                  <option value="field_engineer">Field Engineer (Hanya Ganti Password)</option>
                  <option value="sales_corporate">Sales Corporate (Hanya Ganti Password)</option>
                  <option value="admin">Administrator (Bisa Tambah, Edit & Hapus User)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newRole === "admin"
                    ? "Akun Administrator memiliki hak penuh untuk menambah, mengedit & menghapus user."
                    : "Akun non-admin hanya memiliki hak untuk mengganti password sendiri."}
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {addLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menambahkan...</span>
                    </>
                  ) : (
                    <span>+ Simpan Pengguna</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PENGGUNA (ADMIN ONLY) */}
      {isAdmin && isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Data Pengguna
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Akses Administrator ACTIS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Kantor
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@isp-enterprise.net"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Level Akses (Peran / Role)
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                >
                  <option value="noc_engineer">NOC Engineer (Hanya Ganti Password)</option>
                  <option value="field_engineer">Field Engineer (Hanya Ganti Password)</option>
                  <option value="sales_corporate">Sales Corporate (Hanya Ganti Password)</option>
                  <option value="admin">Administrator (Bisa Tambah, Edit & Hapus User)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {editRole === "admin"
                    ? "Akun Administrator memiliki hak penuh untuk menambah, mengedit & menghapus user."
                    : "Akun non-admin hanya memiliki hak untuk mengganti password sendiri."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reset Password Baru (Opsional)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Isi minimal 6 karakter jika ingin mereset password akun ini. Biarkan kosong untuk tetap memakai password saat ini.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {editLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS PENGGUNA (ADMIN ONLY) */}
      {isAdmin && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-scaleUp text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Hapus Pengguna?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Apakah Anda yakin ingin menghapus akun <strong>{deleteTarget.nama}</strong> ({deleteTarget.email})? Tindakan ini tidak dapat dibatalkan.
            </p>

            {deleteError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 transition shadow-md shadow-rose-500/25 disabled:opacity-50 flex items-center space-x-1.5"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Pengguna</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
