#!/usr/bin/env node

/**
 * ACTIS User Provisioning CLI Tool
 *
 * Digunakan untuk membuat atau memperbarui akun pengguna langsung di server VPS / Docker.
 *
 * Penggunaan Langsung (Argumen):
 *   node scripts/create-user.js <email> <password> [role] [nama]
 *
 * Contoh:
 *   node scripts/create-user.js admin@perusahaan.net Rahasia123 admin "Budi Santoso"
 *   node scripts/create-user.js noc@perusahaan.net Noc2026! noc_engineer "Teknisi NOC"
 *
 * Penggunaan Interaktif:
 *   node scripts/create-user.js
 *
 * Pada Server VPS (Docker):
 *   docker exec -it actis-web node scripts/create-user.js <email> <password> [role] [nama]
 */

const crypto = require("crypto");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Muat .env jika DATABASE_URL belum terdefinisi di environment
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        let val = v.join("=").trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const VALID_ROLES = ["admin", "noc_engineer", "field_engineer", "sales_corporate"];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  try {
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function run() {
  console.log("==================================================");
  console.log("   ACTIS — PEMBUATAN AKUN USER (VPS / LOCAL CLI)   ");
  console.log("==================================================");

  let [, , argEmail, argPassword, argRole, ...argNamaParts] = process.argv;
  let email = argEmail ? argEmail.trim().toLowerCase() : "";
  let password = argPassword ? argPassword.trim() : "";
  let role = argRole ? argRole.trim().toLowerCase() : "";
  let nama = argNamaParts.length > 0 ? argNamaParts.join(" ").trim() : "";

  // Jika argumen tidak lengkap, jalankan mode interaktif
  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      if (!email) {
        email = (await askQuestion(rl, "Masukkan Email (contoh: admin@domain.com): ")).trim().toLowerCase();
      }
      if (!password) {
        password = (await askQuestion(rl, "Masukkan Password (minimal 6 karakter): ")).trim();
      }
      if (!role) {
        console.log("\nPilihan Role:");
        console.log("  1. admin (Full Access)");
        console.log("  2. noc_engineer (Operasional NOC)");
        console.log("  3. field_engineer (Teknisi Lapangan)");
        console.log("  4. sales_corporate (Bisnis / Sales)");
        const roleChoice = (await askQuestion(rl, "Pilih Role [1/2/3/4 atau ketik langsung] (default: 1): ")).trim();

        if (roleChoice === "1" || roleChoice === "admin" || !roleChoice) role = "admin";
        else if (roleChoice === "2" || roleChoice === "noc_engineer") role = "noc_engineer";
        else if (roleChoice === "3" || roleChoice === "field_engineer") role = "field_engineer";
        else if (roleChoice === "4" || roleChoice === "sales_corporate") role = "sales_corporate";
        else role = roleChoice;
      }
      if (!nama) {
        const defaultNama = email.split("@")[0].toUpperCase() + (role === "admin" ? " (Admin)" : "");
        nama = (await askQuestion(rl, `Masukkan Nama Lengkap (default: ${defaultNama}): `)).trim() || defaultNama;
      }
    } finally {
      rl.close();
    }
  }

  // Validasi format email
  if (!email || !email.includes("@") || !email.includes(".")) {
    console.error("\n❌ [ERROR] Format email tidak valid.");
    process.exit(1);
  }

  // Validasi password
  if (!password || password.length < 6) {
    console.error("\n❌ [ERROR] Password minimal harus 6 karakter.");
    process.exit(1);
  }

  // Default role & nama jika kosong
  if (!role) role = "admin";
  if (!VALID_ROLES.includes(role)) {
    console.error(`\n❌ [ERROR] Role '${role}' tidak valid. Pilihan role: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  if (!nama) {
    nama = email.split("@")[0].toUpperCase() + (role === "admin" ? " (Admin)" : "");
  }

  console.log("\nMemproses akun...");
  console.log(`- Email : ${email}`);
  console.log(`- Role  : ${role}`);
  console.log(`- Nama  : ${nama}`);

  const password_hash = hashPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  let savedUser;
  if (existing) {
    console.log(`\nAkun dengan email '${email}' sudah ada. Memperbarui password & data...`);
    savedUser = await prisma.user.update({
      where: { email },
      data: {
        nama,
        role,
        password_hash,
      },
    });
    console.log("✓ Data akun berhasil diperbarui!");
  } else {
    savedUser = await prisma.user.create({
      data: {
        email,
        nama,
        role,
        password_hash,
      },
    });
    console.log("✓ Akun baru berhasil dibuat!");
  }

  // Uji verifikasi otentikasi
  const verifyCheck = verifyPassword(password, savedUser.password_hash);
  if (verifyCheck) {
    console.log("✓ Verifikasi hash password: LULUS (Siap digunakan untuk login).");
  } else {
    console.error("❌ Verifikasi hash gagal. Silakan periksa kembali.");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("             AKUN BERHASIL DIAKTIFKAN             ");
  console.log("==================================================");
  console.log(`ID Pengguna : ${savedUser.id}`);
  console.log(`Email       : ${savedUser.email}`);
  console.log(`Role        : ${savedUser.role}`);
  console.log(`Nama        : ${savedUser.nama}`);
  console.log("Silakan gunakan kredensial ini untuk login pada halaman web ACTIS.\n");
}

run()
  .catch((err) => {
    console.error("\n❌ [ERROR]:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

