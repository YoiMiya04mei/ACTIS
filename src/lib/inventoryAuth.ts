import { AuthenticatedUser } from "./security";

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
