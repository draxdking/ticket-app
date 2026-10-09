import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPage, sitemap, siteOrigin } from "../lib/seo.js";
import { seoFor } from "../src/seo.js";
const sample = {
  id: "sample",
  title: "</script><script>alert(1)</script>",
  description: "A home with <views> & space.",
  location: "Ikeja, Lagos",
  city: "Lagos",
  type: "Apartment",
  purpose: "Sale",
  price: 10000000,
  beds: 3,
  baths: 3,
  area: 150,
  image: "/uploads/photo.jpg",
  demo: true,
};
const template =
  '<html><head><title>Default</title></head><body><div id="root"></div></body></html>';
test("server HTML escapes untrusted listing content and JSON script boundaries", () => {
  const page = renderPage(
    template,
    "/properties/sample",
    [sample],
    "https://homestead.example",
  );
  assert.equal(page.status, 200);
  assert(!page.html.includes("<script>alert(1)</script>"));
  assert(page.html.includes("\\u003c/script>"));
  assert(page.html.includes("&lt;script&gt;"));
  const boot = JSON.parse(
    page.html.match(
      /id="page-data" type="application\/json">(.*?)<\/script>/s,
    )[1],
  );
  assert.equal(boot.properties[0].title, sample.title);
});
test("development, demo, private and missing pages are excluded from indexing", () => {
  for (const [path, base] of [
    ["/", ""],
    ["/agent", "https://homestead.example"],
    ["/properties/sample", "https://homestead.example"],
    ["/missing", "https://homestead.example"],
  ])
    assert.equal(seoFor(path, [sample], base).indexable, false);
  assert(
    !sitemap([sample], "https://homestead.example").includes(
      "/properties/sample",
    ),
  );
  assert(!sitemap([sample], "").includes("<url>"));
  assert.equal(seoFor("/", [], "https://homestead.example").indexable, true);
  assert.throws(() => siteOrigin("https://example.com/subpath"));
  assert.throws(() => siteOrigin("http://localhost:3000"));
});
