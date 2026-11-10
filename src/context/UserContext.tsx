"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AppUser {
  id: string;
  nama: string;
  email: string;
  role: "admin" | "noc_engineer" | "field_engineer" | "sales_corporate" | string;
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  addUser: (data: { nama: string; email: string; password: string; role: string }) => Promise<{ success: boolean; error?: string; data?: any }>;
  updateUser: (id: string, data: { nama: string; email: string; role: string; password?: string }) => Promise<{ success: boolean; error?: string; data?: any; message?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  fetchUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser>(DEMO_USERS[0]); // default to Admin Ahmad Fauzi
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<AppUser[]>(DEMO_USERS);

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

  // Initialize user from local storage or cookie session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const saved = localStorage.getItem("actis_active_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          setCurrentUserState(parsed);
          setIsAuthenticated(true);
        } else {
          // If no stored user, verify from server session or fallback
          const meRes = await fetch("/api/auth/me");
          const meJson = await meRes.json();
          if (meJson.success && meJson.user) {
            setCurrentUserState(meJson.user);
            setIsAuthenticated(true);
            localStorage.setItem("actis_active_user", JSON.stringify(meJson.user));
          } else {
            // Set default admin for initial convenience or prompt login
            setCurrentUserState(DEMO_USERS[0]);
            setIsAuthenticated(true);
            localStorage.setItem("actis_active_user", JSON.stringify(DEMO_USERS[0]));
          }
        }
      } catch (err) {
        console.error("Failed to initialize auth", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
    fetchUsers();
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

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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

      handleSetUser(data.user);
      await fetchUsers();

      try {
        fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama_lengkap: data.user.nama,
            email: data.user.email,
            tipe: "LOGIN_SUCCESS",
            aktifitas: `Berhasil login ke aplikasi`,
          }),
        }).catch(() => {});
      } catch {}

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Terjadi kesalahan koneksi server." };
    }
  };

  const logout = async () => {
    try {
      if (currentUser) {
        fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama_lengkap: currentUser.nama,
            email: currentUser.email,
            tipe: "LOGOUT",
            aktifitas: `Sesi ditutup — logout dari aplikasi`,
          }),
        }).catch(() => {});
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      localStorage.removeItem("actis_active_user");
      setIsAuthenticated(false);
      // Optional: keep currentUser as null or fallback
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

  const addUser = async (userData: { nama: string; email: string; password: string; role: string }) => {
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
    userData: { nama: string; email: string; role: string; password?: string }
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
          role: data.data.role,
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
