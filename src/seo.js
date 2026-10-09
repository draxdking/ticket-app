export const propertyPath = (p) => "/properties/" + encodeURIComponent(p.id);
export function seoFor(path, properties = [], siteUrl = "") {
  const base = siteUrl.replace(/\/$/, "");
  const property = properties.find((p) => propertyPath(p) === path);
  const known =
    ["/", "/for-agents", "/agent"].includes(path) || Boolean(property);
  const privatePage = path === "/agent";
  const money = (n) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(n);
  const title = property
    ? `${property.beds ? property.beds + "-bedroom " : ""}${property.type} for ${property.purpose.toLowerCase()} in ${property.location} | Homestead Nigeria`
    : path === "/for-agents"
      ? "Real estate agent workspace in Nigeria | Homestead"
      : privatePage
        ? "Agent sign-in | Homestead Nigeria"
        : !known
          ? "Page not found | Homestead Nigeria"
          : "Homes for sale & rent in Nigeria | Homestead";
  const description = property
    ? `${property.title}. ${money(property.price)}${property.purpose === "Rent" ? " per year" : ""}. ${property.description}`.slice(
        0,
        160,
      )
    : path === "/for-agents"
      ? "Manage Nigerian property listings, client enquiries and viewings in one agent workspace. Upload photos, show fees and connect with clients on WhatsApp."
      : "Find properties for sale and rent across Nigeria. Explore homes in Lagos, Abuja, Ibadan and Port Harcourt, compare costs and contact listing agents.";
  const indexable = Boolean(base) && known && !privatePage && !property?.demo;
  const canonical = known && base ? base + path : "";
  const rawImage = property?.images?.[0] || property?.image;
  const image = rawImage
    ? rawImage.startsWith("/")
      ? base
        ? base + rawImage
        : ""
      : rawImage
    : "";
  let structured = null;
  if (indexable && property)
    structured = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: title,
      description: property.description,
      url: canonical,
      image: (property.images || [property.image]).map((i) =>
        i.startsWith("/") ? base + i : i,
      ),
      about: {
        "@type": "Accommodation",
        name: property.title,
        address: {
          "@type": "PostalAddress",
          streetAddress: property.location,
          addressLocality: property.city,
          addressCountry: "NG",
        },
        numberOfBedrooms: property.beds,
        floorSize: {
          "@type": "QuantitativeValue",
          value: property.area,
          unitCode: "MTK",
        },
      },
      offers: {
        "@type": "Offer",
        price: property.price,
        priceCurrency: "NGN",
        url: canonical,
        businessFunction:
          property.purpose === "Rent"
            ? "http://purl.org/goodrelations/v1#LeaseOut"
            : "http://purl.org/goodrelations/v1#Sell",
        ...(property.purpose === "Rent"
          ? {
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: property.price,
                priceCurrency: "NGN",
                unitText: "year",
              },
            }
          : {}),
      },
    };
  else if (indexable && path === "/")
    structured = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Homestead Nigeria",
      url: base + "/",
      description,
      inLanguage: "en-NG",
    };
  return {
    title,
    description,
    canonical,
    image,
    indexable,
    known,
    property,
    structured,
  };
}
export function updateSeo(path, properties, siteUrl) {
  const seo = seoFor(path, properties, siteUrl);
  document.title = seo.title;
  for (const [key, value, attr] of [
    ["description", seo.description, "name"],
    ["robots", seo.indexable ? "index,follow" : "noindex,follow", "name"],
    ["og:title", seo.title, "property"],
    ["og:description", seo.description, "property"],
    ["og:type", seo.property ? "article" : "website", "property"],
    ["og:url", seo.canonical, "property"],
    ["og:image", seo.image, "property"],
    ["og:locale", "en_NG", "property"],
    ["twitter:card", seo.image ? "summary_large_image" : "summary", "name"],
    ["twitter:title", seo.title, "name"],
    ["twitter:description", seo.description, "name"],
    ["twitter:image", seo.image, "name"],
  ]) {
    let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!value) {
      tag?.remove();
      continue;
    }
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.append(tag);
    }
    tag.content = value;
  }
  let link = document.head.querySelector('link[rel="canonical"]');
  if (seo.canonical) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.append(link);
    }
    link.href = seo.canonical;
  } else link?.remove();
  document.getElementById("structured-data")?.remove();
  if (seo.structured) {
    const tag = document.createElement("script");
    tag.id = "structured-data";
    tag.type = "application/ld+json";
    tag.textContent = JSON.stringify(seo.structured);
    document.head.append(tag);
  }
}
