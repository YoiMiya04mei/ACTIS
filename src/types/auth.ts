export type UserRole = 'admin' | 'engineer' | 'staff' | 'viewer';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  position: string;
  avatarColor?: string;
  password?: string;
  createdAt: string;
}

export interface RolePermissions {
  canCreateRFO: boolean;
  canEditRFO: boolean;
  canDeleteRFO: boolean;
  canManageTemplates: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  canExportDocuments: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canCreateRFO: true,
    canEditRFO: true,
    canDeleteRFO: true,
    canManageTemplates: true,
    canManageSettings: true,
    canManageUsers: true,
    canExportDocuments: true,
  },
  engineer: {
    canCreateRFO: true,
    canEditRFO: true,
    canDeleteRFO: false,
    canManageTemplates: false,
    canManageSettings: false,
    canManageUsers: false,
    canExportDocuments: true,
  },
  staff: {
    canCreateRFO: true,
    canEditRFO: true,
    canDeleteRFO: false,
    canManageTemplates: false,
    canManageSettings: false,
    canManageUsers: false,
    canExportDocuments: true,
  },
  viewer: {
    canCreateRFO: false,
    canEditRFO: false,
    canDeleteRFO: false,
    canManageTemplates: false,
    canManageSettings: false,
    canManageUsers: false,
    canExportDocuments: true,
  },
};

export const ROLE_LABELS: Record<UserRole, { label: string; badgeClass: string; desc: string }> = {
  admin: {
    label: 'Super Admin',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    desc: 'Akses penuh seluruh modul, kelola template, user & hapus data',
  },
  engineer: {
    label: 'NOC Engineer',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    desc: 'Buat & edit RFO, ekspor dokumen resmi & WhatsApp',
  },
  staff: {
    label: 'Customer Support',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    desc: 'Buat RFO layanan pelanggan, salin teks & unduh dokumen',
  },
  viewer: {
    label: 'Auditor / Viewer',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    desc: 'Hanya melihat riwayat & unduh dokumen (read-only)',
  },
};
