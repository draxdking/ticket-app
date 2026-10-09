import { db } from "../lib/store.js";
import {
  createUser,
  normalizeEmail,
  normalizePhone,
  validEmail,
  validPassword,
} from "../lib/auth.js";
const [email, name, phone] = process.argv.slice(2),
  password = process.env.ADMIN_PASSWORD;
const existing = validEmail(email)
  ? db.prepare("SELECT id FROM users WHERE email=?").get(normalizeEmail(email))
  : null;
if (
  !validEmail(email) ||
  (!existing && (!name || !normalizePhone(phone) || !validPassword(password)))
) {
  console.error(
    'Usage: ADMIN_PASSWORD supplied securely, node scripts/create-admin.js email "Full name" Nigerian-mobile-number. Password must be 12–128 characters.',
  );
  process.exit(1);
}
if (existing) {
  db.prepare("UPDATE users SET role='admin',active=1 WHERE id=?").run(
    existing.id,
  );
  console.log(
    "Existing account promoted to administrator; its password is unchanged.",
  );
} else {
  await createUser({ email, name, phone, password, role: "admin" });
  console.log("Administrator created.");
}
