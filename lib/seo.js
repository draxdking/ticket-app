import { seoFor, propertyPath } from "../src/seo.js";
export function siteOrigin(value) {
  if (!value) return "";
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    u.username ||
    u.password
  )
    throw Error(
      "SITE_URL must be your public HTTPS origin, for example https://your-domain.example",
    );
  return u.origin;
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
export function renderPage(template, path, properties, siteUrl) {
  const s = seoFor(path, properties, siteUrl);
  const meta = (name, content, attr = "name") =>
    content ? `<meta ${attr}="${name}" content="${escape(content)}"/>` : "";
  const head =
    meta("description", s.description) +
    meta("robots", s.indexable ? "index,follow" : "noindex,follow") +
    (s.canonical
      ? `<link rel="canonical" href="${escape(s.canonical)}"/>`
      : "") +
    meta("og:title", s.title, "property") +
    meta("og:description", s.description, "property") +
    meta("og:type", s.property ? "article" : "website", "property") +
    meta("og:url", s.canonical, "property") +
    meta("og:image", s.image, "property") +
    meta("og:locale", "en_NG", "property") +
    meta("twitter:card", s.image ? "summary_large_image" : "summary") +
    meta("twitter:title", s.title) +
    meta("twitter:description", s.description) +
    meta("twitter:image", s.image) +
    (s.structured
      ? `<script id="structured-data" type="application/ld+json">${json(s.structured)}</script>`
      : "");
  const links = properties
    .map(
      (p) =>
        `<article><a href="${escape(propertyPath(p))}"><img src="${escape(p.image)}" alt="${escape(p.type + " in " + p.location)}" width="400" height="260" loading="lazy"/><h2>${escape(p.title)}</h2></a><p>${escape(p.location)} · ${escape(p.beds)} bedrooms · ${escape(p.area)} m²</p><p>₦${Number(p.price).toLocaleString("en-NG")}${p.purpose === "Rent" ? " per year" : ""}</p>${p.demo ? "<p>Illustrative demo listing</p>" : ""}</article>`,
    )
    .join("");
  let content;
  if (s.property) {
    const p = s.property;
    const fees = Object.entries(p.fees || {}).filter(([, f]) => f.amount > 0),
      total = p.price + fees.reduce((sum, [, f]) => sum + f.amount, 0);
    content = `<h1>${escape(s.title.split(" | ")[0])}</h1><img src="${escape(p.image)}" alt="${escape(p.title + " in " + p.location)}" width="800" height="520"/><h2>${escape(p.title)}</h2><p>${escape(p.description)}</p><p>${escape(p.location)} · ${escape(p.beds)} bedrooms · ${escape(p.baths)} bathrooms · ${escape(p.area)} m²</p><h2>Property costs</h2><p>${p.purpose === "Rent" ? "Annual rent" : "Purchase price"}: ₦${Number(p.price).toLocaleString("en-NG")}</p><ul>${fees.map(([key, f]) => `<li>${escape(key)}: ₦${f.amount.toLocaleString("en-NG")} (${escape(f.frequency)}${f.refundable ? ", refundable" : ""})</li>`).join("")}</ul><p>Total initial payment: ₦${total.toLocaleString("en-NG")}</p>${p.agent ? `<p>Listing agent: ${escape(p.agent.name)}</p><a href="https://wa.me/${escape(p.agent.phone)}">Contact the agent on WhatsApp</a>` : ""}<p>${p.demo ? "Illustrative demo listing. " : ""}Verify availability, ownership and costs independently.</p>`;
  } else if (path === "/")
    content = `<h1>Homes for sale and rent in Nigeria</h1><p>Explore homes in Lagos, Abuja, Ibadan and Port Harcourt. Compare property costs and contact listing agents.</p><section>${links || "<p>New listings are coming soon.</p>"}</section>`;
  else if (path === "/for-agents")
    content =
      '<h1>Manage your real estate business in Nigeria</h1><p>Upload property photos, track client enquiries, schedule viewings, share clear fees and connect through WhatsApp.</p><a href="/agent">Create your agent account or sign in</a>';
  else if (path === "/agent")
    content =
      "<h1>Agent sign-in</h1><p>Enable JavaScript to sign in to your private workspace.</p>";
  else
    content =
      '<h1>Page not found</h1><p>This property may no longer be available.</p><a href="/">Browse available properties</a>';
  const fallback = `<header class="header"><a class="brand" href="/">homestead.</a><nav><a href="/">Find a property</a><a href="/for-agents">For agents</a><a href="/agent">Agent workspace</a></nav></header><main class="public-main seo-fallback">${content}</main>`;
  const boot = { path, properties, siteUrl };
  return {
    status: s.known ? 200 : 404,
    html: template
      .replace(/<title>.*?<\/title>/s, `<title>${escape(s.title)}</title>`)
      .replace("</head>", head + "</head>")
      .replace(
        '<div id="root"></div>',
        `<div id="root">${fallback}</div><script id="page-data" type="application/json">${json(boot)}</script>`,
      ),
  };
}
export function sitemap(properties, siteUrl) {
  const urls = siteUrl
    ? [
        siteUrl + "/",
        siteUrl + "/for-agents",
        ...properties
          .filter((p) => !p.demo)
          .map((p) => siteUrl + propertyPath(p)),
      ]
    : [];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join("")}</urlset>`;
}
