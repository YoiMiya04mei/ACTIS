"use client";

import React from "react";
import { useCurrentUser } from "@/context/UserContext";
import { InUseMonitorPanel } from "@/components/inventory/InUseMonitorPanel";

export default function BarangSedangDigunakanPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  return (
    <InUseMonitorPanel
      apiBasePath="/api/inventory/in-use"
      finishEndpoint="/api/inventory/in-use/finish"
      canEditPicLocation={isAdmin}
      showInternalLinks={true}
      showHeader={true}
    />
  );
}
