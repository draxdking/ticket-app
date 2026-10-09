import { db } from "./store.js";
export const feeDefinitions = [
  ["agency", "Agency fee"],
  ["legal", "Legal / agreement fee"],
  ["caution", "Caution deposit"],
  ["service", "Service charge"],
];
export const validText = (v, max = 2000) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function sanitizeProperty(b, ownerId, user, existingImages = []) {
  const images = Array.isArray(b.images) ? b.images : b.image ? [b.image] : [];
  if (
    !["title", "location", "city", "type", "description"].every((k) =>
      validText(b[k]),
    ) ||
    !["Sale", "Rent"].includes(b.purpose) ||
    ![
      "Apartment",
      "Duplex",
      "Terrace",
      "Bungalow",
      "Land",
      "Commercial",
    ].includes(b.type) ||
    !["price", "beds", "baths", "area"].every(
      (k) => Number.isFinite(b[k]) && b[k] >= 0,
    ) ||
    b.price <= 0 ||
    b.price > 1e13 ||
    ![b.beds, b.baths].every(Number.isInteger) ||
    images.length < 1 ||
    images.length > 12
  )
    throw Error(
      "Check the required property fields and add at least one photo.",
    );
  for (const image of images) {
    if (
      !validText(image) ||
      !(
        image.startsWith("https://") ||
        /^\/uploads\/[a-f0-9-]+\.jpg$/.test(image)
      )
    )
      throw Error("Invalid photo.");
    if (image.startsWith("/uploads/")) {
      const upload = db
        .prepare("SELECT user_id FROM uploads WHERE id=?")
        .get(image.slice(9));
      if (
        !upload ||
        (upload.user_id !== ownerId &&
          user.role !== "admin" &&
          !existingImages.includes(image))
      )
        throw Error("This photo does not belong to your account.");
    }
  }
  const fees = {};
  for (const [key] of feeDefinitions) {
    const f = b.fees?.[key] || {
      amount: 0,
      frequency: key === "service" ? "annual" : "once",
      refundable: key === "caution",
    };
    if (
      !Number.isFinite(f.amount) ||
      f.amount < 0 ||
      f.amount > 1e13 ||
      !["once", "annual", "monthly"].includes(f.frequency) ||
      typeof f.refundable !== "boolean"
    )
      throw Error("Check the fee amounts and payment frequency.");
    fees[key] = {
      amount: f.amount,
      frequency: f.frequency,
      refundable: f.refundable,
    };
  }
  return Object.fromEntries([
    ...[
      "title",
      "location",
      "city",
      "type",
      "description",
      "purpose",
      "price",
      "beds",
      "baths",
      "area",
    ].map((k) => [k, b[k]]),
    ["images", images],
    ["image", images[0]],
    ["featured", Boolean(b.featured)],
    ["fees", fees],
    ["ownerId", ownerId],
  ]);
}
