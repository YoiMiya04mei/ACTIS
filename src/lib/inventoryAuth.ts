import { AuthenticatedUser } from "./security";
import type { MenuAccessKey } from "./accessLevels";
import { getAllowedMenusForRole, getStoredAccessLevels } from "./accessLevelsStore";

export interface InventoryPermissions {
  canView: boolean;
  canManageMaster: boolean;
  canCreateInTransaction: boolean;
  canCreateOutTransaction: boolean;
  canReturnItems: boolean;
  canAdjustStock: boolean;
  canPerformOpname: boolean;
  canExportReports: boolean;
  canManageSettings: boolean;
  canEditPicLocation: boolean;
}

export function getInventoryPermissions(user: AuthenticatedUser | null | undefined): InventoryPermissions {
  if (!user) {
    return {
      canView: false,
      canManageMaster: false,
      canCreateInTransaction: false,
      canCreateOutTransaction: false,
      canReturnItems: false,
      canAdjustStock: false,
      canPerformOpname: false,
      canExportReports: false,
      canManageSettings: false,
      canEditPicLocation: false,
    };
  }

  const role = user.role;

  if (role === "admin") {
    return {
      canView: true,
      canManageMaster: true,
      canCreateInTransaction: true,
      canCreateOutTransaction: true,
      canReturnItems: true,
      canAdjustStock: true,
      canPerformOpname: true,
      canExportReports: true,
      canManageSettings: true,
      canEditPicLocation: true,
    };
  }

  if (role === "warehouse_admin") {
    return {
      canView: true,
      canManageMaster: true,
      canCreateInTransaction: true,
      canCreateOutTransaction: true,
      canReturnItems: true,
      canAdjustStock: true,
      canPerformOpname: true,
      canExportReports: true,
      canManageSettings: false, // Settings restricted to Super Admin
      canEditPicLocation: true,
    };
  }

  if (role === "noc_engineer") {
    return {
      canView: true,
      canManageMaster: false,
      canCreateInTransaction: false,
      canCreateOutTransaction: false,
      canReturnItems: false,
      canAdjustStock: false,
      canPerformOpname: false,
      canExportReports: true,
      canManageSettings: false,
      canEditPicLocation: false,
    };
  }

  if (role === "field_engineer") {
    return {
      canView: true,
      canManageMaster: false,
      canCreateInTransaction: false,
      canCreateOutTransaction: false,
      canReturnItems: true, // Field engineers can submit returns for items they hold
      canAdjustStock: false,
      canPerformOpname: false,
      canExportReports: false,
      canManageSettings: false,
      canEditPicLocation: false,
    };
  }

  // sales_corporate or any other role: read-only access
  return {
    canView: true,
    canManageMaster: false,
    canCreateInTransaction: false,
    canCreateOutTransaction: false,
    canReturnItems: false,
    canAdjustStock: false,
    canPerformOpname: false,
    canExportReports: false,
    canManageSettings: false,
    canEditPicLocation: false,
  };
}

/**
 * Checks whether an authenticated ACTIS dashboard user has access to a given
 * inventory menu (default or custom role configured under Level Akses).
 */
export async function canUserAccessInventoryMenu(
  user: AuthenticatedUser | null | undefined,
  menuKey: MenuAccessKey
): Promise<boolean> {
  if (!user || !user.role || user.role === "request_barang") {
    return false;
  }
  if (user.role === "admin") {
    return true;
  }
  const stored = await getStoredAccessLevels();
  const allowedMenus = getAllowedMenusForRole(stored.roles, user.role);
  return allowedMenus.includes(menuKey);
}
