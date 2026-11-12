export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { ensureBackupSchedulerStarted } = await import("@/lib/backupSchedulerService");
    ensureBackupSchedulerStarted(60);

    const { ensureTacacsServerStarted } = await import("@/lib/tacacs/server");
    ensureTacacsServerStarted().catch((err) => {
      console.error("[TACACS+] Startup bootstrap error:", err);
    });
  }
}

