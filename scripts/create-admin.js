const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

async function main() {
  const email = "admin@jembatandata.com";
  const password = "admin123";
  const role = "admin";
  const nama = "Administrator Jembatan Data";

  console.log(`Checking user: ${email}...`);
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  const password_hash = hashPassword(password);

  if (existing) {
    console.log(`User ${email} already exists. Updating password and role...`);
    const updated = await prisma.user.update({
      where: { email },
      data: {
        password_hash,
        role,
        nama,
      },
    });
    console.log("Updated user:", updated.id, updated.email, updated.role);
  } else {
    console.log(`Creating user ${email}...`);
    const created = await prisma.user.create({
      data: {
        email,
        nama,
        role,
        password_hash,
      },
    });
    console.log("Created user:", created.id, created.email, created.role);
  }

  // Verify hash
  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = verifyPassword(password, user.password_hash);
  console.log("Password verification test:", isValid ? "SUCCESS" : "FAILED");
}

main()
  .catch((e) => {
    console.error("Error creating admin user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

