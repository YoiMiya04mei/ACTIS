"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AppUser {
  id: string;
  nama: string;
  email: string;
  username?: string | null;
  role:
    | "admin"
    | "noc_engineer"
    | "field_engineer"
    | "sales_corporate"
    | "warehouse_admin"
    | "request_barang"
    | string;
  request_barang_access?: boolean | null;
  created_at?: string;
}

export const DEMO_USERS: AppUser[] = [
  {
    id: "usr-admin-001",
    nama: "Ahmad Fauzi (Head of NOC)",
    email: "admin.noc@isp-enterprise.net",
    role: "admin",
  },
  {
    id: "usr-noc-001",
    nama: "Budi Santoso (NOC Engineer)",
    email: "budi.santoso@isp-enterprise.net",
    role: "noc_engineer",
  },
  {
    id: "usr-noc-002",
    nama: "Reza Pratama (Senior NOC)",
    email: "reza.pratama@isp-enterprise.net",
    role: "noc_engineer",
  },
  {
    id: "usr-field-001",
    nama: "Dimas Kurniawan (Field Engineer)",
    email: "dimas.k@isp-enterprise.net",
    role: "field_engineer",
  },
  {
    id: "usr-sales-001",
    nama: "Sarah Novita (Sales Corporate)",
    email: "sarah.novita@isp-enterprise.net",
    role: "sales_corporate",
  },
];

interface UserContextType {
  currentUser: AppUser;
  setCurrentUser: (user: AppUser) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  users: AppUser[];
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string; rememberMe?: boolean; user?: AppUser }>;
  loginWithRememberMe: (options?: {
    rememberMe?: boolean;
  }) => Promise<{ success: boolean; error?: string; rememberMe?: boolean; user?: AppUser }>;
  logout: (options?: { reason?: "timeout" | "manual" }) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  addUser: (data: {
    nama: string;
    email?: string;
    username?: string;
    password: string;
    role: string;
    request_barang_access?: boolean;
  }) => Promise<{ success: boolean; error?: string; data?: any }>;
  updateUser: (
    id: string,
    data: {
      nama: string;
      email?: string;
      username?: string;
      role: string;
      password?: string;
      request_barang_access?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string; data?: any; message?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  fetchUsers: () => Promise<void>;
}

export const EMPTY_USER: AppUser = {
  id: "",
  nama: "",
  email: "",
  role: "",
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser>(EMPTY_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<AppUser[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch users list", e);
    }
  }, []);

  // Initialize and verify user from server session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meJson = await meRes.json();
          if (meJson.success && meJson.user) {
            setCurrentUserState(meJson.user);
            setIsAuthenticated(true);
            localStorage.setItem("actis_active_user", JSON.stringify(meJson.user));
            if (meJson.user.role !== "request_barang") {
              fetchUsers();
            }
            return;
          }
        }
        // If not authenticated or invalid session:
        setCurrentUserState(EMPTY_USER);
        setIsAuthenticated(false);
        localStorage.removeItem("actis_active_user");
      } catch (err) {
        console.error("Failed to initialize auth", err);
        setCurrentUserState(EMPTY_USER);
        setIsAuthenticated(false);
        localStorage.removeItem("actis_active_user");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchUsers]);

  const handleSetUser = (user: AppUser) => {
    const prev = currentUser;
    setCurrentUserState(user);
    setIsAuthenticated(true);
    localStorage.setItem("actis_active_user", JSON.stringify(user));

    if (prev && prev.id !== user.id) {
      try {
        fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama_lengkap: user.nama,
            email: user.email,
            tipe: "LOGIN_SUCCESS",
            aktifitas: `Berhasil login ke aplikasi — ${user.nama}`,
          }),
        }).catch(() => {});
      } catch {}
    }
  };

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        try {
          fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nama_lengkap: email.split("@")[0] || email,
              email,
              tipe: "LOGIN_FAILED",
              aktifitas: `Login gagal — username ${email.split("@")[0] || email}`,
            }),
          }).catch(() => {});
        } catch {}
        return { success: false, error: data.error || "Login gagal. Periksa email dan password Anda." };
      }

      const cleanEmail = String(data.user?.email || email).trim().toLowerCase();
      try {
        localStorage.setItem("actis_last_active_timestamp", String(Date.now()));
        if (rememberMe) {
          localStorage.setItem("actis_remembered_email", cleanEmail);
          localStorage.setItem("actis_remember_me", "true");
        } else {
          localStorage.removeItem("actis_remembered_email");
          localStorage.setItem("actis_remember_me", "false");
        }
      } catch {}

      handleSetUser(data.user);
      if (data.user?.role !== "request_barang") {
        await fetchUsers();
      }

      return {
        success: true,
        user: data.user,
        rememberMe: Boolean(data.rememberMe ?? rememberMe),
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Terjadi kesalahan koneksi server." };
    }
  };

  const loginWithRememberMe = async (options?: { rememberMe?: boolean }) => {
    const keepRememberMe = options?.rememberMe !== false;
    try {
      const res = await fetch("/api/auth/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberMe: keepRememberMe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.user) {
        return {
          success: false,
          error: data.error || "Sesi Ingat Saya sudah kedaluwarsa. Silakan masuk dengan email dan password.",
        };
      }

      const cleanEmail = String(data.user.email || "").trim().toLowerCase();
      try {
        localStorage.setItem("actis_last_active_timestamp", String(Date.now()));
        if (keepRememberMe) {
          if (cleanEmail) {
            localStorage.setItem("actis_remembered_email", cleanEmail);
          }
          localStorage.setItem("actis_remember_me", "true");
        } else {
          localStorage.removeItem("actis_remembered_email");
          localStorage.setItem("actis_remember_me", "false");
        }
        localStorage.setItem("actis_active_user", JSON.stringify(data.user));
      } catch {}

      setCurrentUserState(data.user);
      setIsAuthenticated(true);
      if (data.user?.role !== "request_barang") {
        await fetchUsers();
      }

      return { success: true, rememberMe: keepRememberMe, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || "Terjadi kesalahan koneksi server." };
    }
  };

  const logout = async (options?: { reason?: "timeout" | "manual" }) => {
    const reason = options?.reason || "manual";
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      localStorage.removeItem("actis_active_user");
      setCurrentUserState(EMPTY_USER);
      setIsAuthenticated(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser?.id,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Gagal mengubah password." };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || "Gagal mengubah password." };
    }
  };

  const addUser = async (userData: {
    nama: string;
    email?: string;
    username?: string;
    password: string;
    role: string;
    request_barang_access?: boolean;
  }) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userData,
          actorRole: currentUser?.role,
          actorId: currentUser?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Gagal menambah user." };
      }
      await fetchUsers();
      return { success: true, data: data.data };
    } catch (err: any) {
      return { success: false, error: err.message || "Gagal menambah user." };
    }
  };

  const updateUser = async (
    id: string,
    userData: {
      nama: string;
      email?: string;
      username?: string;
      role: string;
      password?: string;
      request_barang_access?: boolean;
    }
  ) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userData,
          actorRole: currentUser?.role,
          actorId: currentUser?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Gagal mengedit user." };
      }

      // If the edited user is the current active user, update state & localStorage
      if (currentUser && currentUser.id === id) {
        const updated = {
          ...currentUser,
          nama: data.data.nama,
          email: data.data.email,
          username: data.data.username,
          role: data.data.role,
          request_barang_access: data.data.request_barang_access,
        };
        setCurrentUserState(updated);
        localStorage.setItem("actis_active_user", JSON.stringify(updated));
      }

      await fetchUsers();
      return { success: true, data: data.data, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || "Gagal mengedit user." };
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}?actorRole=${currentUser?.role}&actorId=${currentUser?.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Gagal menghapus user." };
      }
      await fetchUsers();
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || "Gagal menghapus user." };
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        setCurrentUser: handleSetUser,
        isAuthenticated,
        isLoading,
        users,
        login,
        loginWithRememberMe,
        logout,
        changePassword,
        addUser,
        updateUser,
        deleteUser,
        fetchUsers,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within UserProvider");
  return ctx;
}
