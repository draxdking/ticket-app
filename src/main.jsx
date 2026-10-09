import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { propertyPath, updateSeo } from "./seo.js";
const boot = JSON.parse(
  document.getElementById("page-data")?.textContent || "{}",
);
const pageForPath = (path) =>
  path === "/agent"
    ? "dashboard"
    : path === "/for-agents"
      ? "about"
      : path === "/" || path.startsWith("/properties/")
        ? "discover"
        : "notfound";
import {
  AuthForm,
  Profile,
  Agents,
  FeeBreakdown,
  Gallery,
  PropertyEditor,
} from "./upgrades.jsx";
const money = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
async function api(path, method = "GET", body) {
  const r = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const b = await r.json();
  if (!r.ok) {
    const error = Error(b.error || "Please try again.");
    error.status = r.status;
    throw error;
  }
  return b;
}
const empty = {
  title: "",
  type: "Apartment",
  location: "",
  city: "Lagos",
  purpose: "Sale",
  price: "",
  beds: 3,
  baths: 3,
  area: "",
  image: "",
  description: "",
  featured: false,
};
const types = [
  "Apartment",
  "Duplex",
  "Terrace",
  "Bungalow",
  "Land",
  "Commercial",
];
function App() {
  const [user, User] = useState(null),
    [authReady, AuthReady] = useState(false);
  const [routePath, Route] = useState(window.location.pathname);
  const [page, S] = useState(pageForPath(window.location.pathname)),
    [tab, T] = useState("overview"),
    [properties, P] = useState(boot.properties || []),
    [leads, L] = useState([]),
    [viewings, V] = useState([]),
    [loading, Loading] = useState(!boot.properties),
    [error, E] = useState(""),
    [notice, N] = useState("");
  const [purpose, Purpose] = useState("All"),
    [city, City] = useState("All"),
    [type, Type] = useState("All"),
    [query, Q] = useState(""),
    [max, Max] = useState(""),
    [sort, Sort] = useState("featured");
  const [selected, Selected] = useState(
      (boot.properties || []).find(
        (p) => propertyPath(p) === window.location.pathname,
      ) || null,
    ),
    [editor, Editor] = useState(null),
    [viewForm, ViewForm] = useState(false),
    [busy, Busy] = useState(false),
    [sent, Sent] = useState(false);
  async function refresh() {
    try {
      const p = await api(
        "properties" + (page === "dashboard" && user ? "?mine=1" : ""),
      );
      P(p);
      if (routePath.startsWith("/properties/")) {
        const match = p.find((item) => propertyPath(item) === routePath);
        Selected(match || null);
        if (!match) S("notfound");
      }
      if (user) {
        const [l, v] = await Promise.all([api("leads"), api("viewings")]);
        L(l);
        V(v);
      } else {
        L([]);
        V([]);
      }
      E("");
    } catch (e) {
      if (e.status === 401) {
        User(null);
        L([]);
        V([]);
        P([]);
      }
      E(e.message);
    } finally {
      Loading(false);
    }
  }
  useEffect(() => {
    api("auth/me")
      .then((r) => User(r.user))
      .catch((e) => E(e.message))
      .finally(() => AuthReady(true));
  }, []);
  useEffect(() => {
    if (authReady) refresh();
  }, [authReady, user, page, routePath]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => N(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function save(path, method, body, message) {
    Busy(true);
    try {
      await api(path, method, body);
      await refresh();
      N(message);
      return true;
    } catch (e) {
      if (e.status === 401) {
        User(null);
        L([]);
        V([]);
        P([]);
      }
      E(e.message);
      return false;
    } finally {
      Busy(false);
    }
  }
  function navigate(path) {
    window.history.pushState({}, "", path);
    Route(path);
    S(pageForPath(path));
  }
  useEffect(() => {
    const onPop = () => {
      Route(window.location.pathname);
      S(pageForPath(window.location.pathname));
      Selected(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    updateSeo(routePath, properties, boot.siteUrl || "");
  }, [routePath, properties]);
  function go(p) {
    if (p !== page) {
      P([]);
      Loading(true);
    }
    Selected(null);
    navigate(
      p === "dashboard" ? "/agent" : p === "about" ? "/for-agents" : "/",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function open(p) {
    navigate(propertyPath(p));
    Selected(p);
    Sent(false);
    E("");
  }
  function closeProperty() {
    Selected(null);
    navigate("/");
  }
  const HeroHeading = routePath === "/" ? "h1" : "h2";
  const cities = [
    ...new Set([
      "Lagos",
      "Abuja",
      "Ibadan",
      "Port Harcourt",
      ...properties.map((p) => p.city),
    ]),
  ];
  const filtered = properties
    .filter(
      (p) =>
        (purpose === "All" || p.purpose === purpose) &&
        (city === "All" || p.city === city) &&
        (type === "All" || p.type === type) &&
        (!max || p.price <= Number(max)) &&
        `${p.title} ${p.location}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Number(b.featured) - Number(a.featured),
    );
  const location = (id) =>
    properties.find((p) => p.id === id)?.location || "Removed property";
  return (
    <>
      <header className="header">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("discover");
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            ⌂
          </span>
          homestead<span className="brand-dot">.</span>
        </a>
        <nav>
          <a
            href="/"
            className={page === "discover" ? "active" : ""}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                go("discover");
              }
            }}
          >
            Find a property
          </a>
          <a
            href="/for-agents"
            className={page === "about" ? "active" : ""}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                go("about");
              }
            }}
          >
            For agents
          </a>
        </nav>
        <button className="button dark small" onClick={() => go("dashboard")}>
          Agent workspace <span>↗</span>
        </button>
      </header>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => E("")}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
      {page === "notfound" && (
        <main className="empty">
          <h1>Page not found</h1>
          <p>This property may no longer be available.</p>
          <a
            className="button dark"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              go("discover");
            }}
          >
            Browse properties
          </a>
        </main>
      )}
      {page === "discover" && (
        <>
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow">
                <span />
                YOUR NEXT CHAPTER, RIGHT HERE
              </div>
              <HeroHeading>
                A place to live.
                <br />A place to <em>belong.</em>
              </HeroHeading>
              <p>
                Discover homes and spaces across Nigeria.
                <br />
                Find the one that feels like you.
              </p>
              <a className="hero-link" href="#listings">
                Explore the collection <span>↓</span>
              </a>
              <div className="hero-caption">
                GOOD SPACES. NEW POSSIBILITIES.
              </div>
            </div>
            <div className="hero-photo">
              <div className="photo-label">
                A new perspective on home <span>↗</span>
              </div>
            </div>
          </section>
          <main className="public-main">
            <section className="search-panel" aria-label="Property search">
              <div className="search-tabs">
                {["All", "Sale", "Rent"].map((x) => (
                  <button
                    className={purpose === x ? "selected" : ""}
                    key={x}
                    onClick={() => Purpose(x)}
                  >
                    {x === "All"
                      ? "All properties"
                      : x === "Sale"
                        ? "Buy a home"
                        : "Rent a home"}
                  </button>
                ))}
              </div>
              <div className="search-fields">
                <label>
                  LOCATION
                  <select value={city} onChange={(e) => City(e.target.value)}>
                    <option value="All">Anywhere in Nigeria</option>
                    {cities.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  PROPERTY TYPE
                  <select value={type} onChange={(e) => Type(e.target.value)}>
                    <option value="All">Any property type</option>
                    {types.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  MAX. BUDGET (₦)
                  <input
                    type="number"
                    min="0"
                    placeholder="No maximum"
                    value={max}
                    onChange={(e) => Max(e.target.value)}
                  />
                </label>
                <a className="button dark" href="#listings">
                  Find my place <span>↗</span>
                </a>
              </div>
            </section>
            <section className="listings" id="listings">
              <div className="section-top">
                <div>
                  <div className="eyebrow muted">SPACES WORTH DISCOVERING</div>
                  <h2>
                    Find your next address<span>.</span>
                  </h2>
                </div>
                <p>
                  From a first home to a fresh start,
                  <br />
                  there’s a space for every chapter.
                </p>
              </div>
              <div className="results-bar">
                <span>
                  {filtered.length} properties to explore{" "}
                  <small>
                    {" "}
                    ·{" "}
                    {properties.some((p) => p.demo)
                      ? "Includes illustrative demo listings"
                      : "Homes listed by our agents"}
                  </small>
                </span>
                <div className="results-controls">
                  <input
                    aria-label="Search listings"
                    placeholder="Search neighbourhood…"
                    value={query}
                    onChange={(e) => Q(e.target.value)}
                  />
                  <select
                    aria-label="Sort properties"
                    value={sort}
                    onChange={(e) => Sort(e.target.value)}
                  >
                    <option value="featured">Featured first</option>
                    <option value="low">Price: low to high</option>
                    <option value="high">Price: high to low</option>
                  </select>
                </div>
              </div>
              {loading ? (
                <div className="empty">Finding your next address…</div>
              ) : !filtered.length ? (
                <div className="empty">
                  <h3>No properties match your search.</h3>
                  <p>Try another location or a higher budget.</p>
                  <button
                    className="button dark"
                    onClick={() => {
                      Purpose("All");
                      City("All");
                      Type("All");
                      Max("");
                      Q("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="property-grid">
                  {filtered.map((p) => (
                    <article className="property-card" key={p.id}>
                      <button
                        className="card-image"
                        onClick={() => open(p)}
                        aria-label={"View " + p.title}
                      >
                        <img
                          src={p.image}
                          alt={p.type + " in " + p.location}
                          width="400"
                          height="260"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="tag">
                          FOR {p.purpose.toUpperCase()}
                        </span>
                        {p.featured && (
                          <span className="featured">✦ FEATURED</span>
                        )}
                        <span className="image-arrow">↗</span>
                      </button>
                      <div className="card-body">
                        <div className="property-location">⌖ {p.location}</div>
                        <a
                          className="card-title"
                          href={propertyPath(p)}
                          onClick={(e) => {
                            if (
                              !e.ctrlKey &&
                              !e.metaKey &&
                              !e.shiftKey &&
                              e.button === 0
                            ) {
                              e.preventDefault();
                              open(p);
                            }
                          }}
                        >
                          {p.title}
                        </a>
                        <div className="property-specs">
                          <span>{p.beds} beds</span>
                          <span>{p.baths} baths</span>
                          <span>{p.area} m²</span>
                        </div>
                        <div className="card-bottom">
                          <strong>
                            {money(p.price)}
                            {p.purpose === "Rent" && <small> / year</small>}
                          </strong>
                          <span>{p.type}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="agent-banner">
              <div className="banner-art">
                ⌂
                <span>
                  Built for your
                  <br />
                  next big move.
                </span>
              </div>
              <div>
                <div className="eyebrow">
                  FOR THE PEOPLE BEHIND THE PROPERTIES
                </div>
                <h2>
                  Your business.
                  <br />
                  All in one place.
                </h2>
                <p>
                  Manage your listings, follow up with leads, and keep
                  <br />
                  every viewing on track with the agent workspace.
                </p>
                <button
                  className="button cream"
                  onClick={() => go("dashboard")}
                >
                  Explore the workspace <span>↗</span>
                </button>
              </div>
            </section>
          </main>
        </>
      )}
      {page === "about" && (
        <main className="about">
          <div className="eyebrow muted">A BETTER WAY TO WORK</div>
          <h1>
            More connections.
            <br />
            <em>Less admin.</em>
          </h1>
          <p>One place for your properties, prospects, and appointments.</p>
          <div className="features">
            {[
              [
                "01",
                "Keep your portfolio in order",
                "Add, edit, and showcase properties across Nigeria.",
              ],
              [
                "02",
                "Build better relationships",
                "Track each enquiry from new to contacted to closed.",
              ],
              [
                "03",
                "Make every viewing count",
                "Schedule appointments and record their outcomes.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <button className="button dark" onClick={() => go("dashboard")}>
            Open agent workspace ↗
          </button>
          <p className="demo-note">
            Your own workspace. Your properties, clients, and appointments.
          </p>
        </main>
      )}
      {page === "dashboard" && !authReady && (
        <div className="empty">Opening your workspace…</div>
      )}
      {page === "dashboard" && authReady && !user && (
        <AuthForm
          api={api}
          onSignedIn={(u) => {
            User(u);
            T("overview");
            N("Welcome, " + u.name);
          }}
        />
      )}
      {page === "dashboard" && user && (
        <main className="workspace">
          <aside>
            <div className="eyebrow muted">AGENT WORKSPACE</div>
            {[
              ["overview", "◈", "Overview"],
              ["properties", "⌂", "Properties"],
              ["leads", "◎", "Leads"],
              ["viewings", "▦", "Viewings"],
              ["profile", "○", "Profile"],
              ...(user.role === "admin" ? [["agents", "♧", "Agents"]] : []),
            ].map(([id, icon, title]) => (
              <button
                key={id}
                className={tab === id ? "current" : ""}
                onClick={() => T(id)}
              >
                <span aria-hidden="true">{icon}</span>
                {title}
              </button>
            ))}
            <div className="workspace-note">
              <strong>{user.name}</strong>
              <p>{user.role === "admin" ? "Administrator" : "Agent account"}</p>
              <button
                className="sign-out"
                onClick={async () => {
                  try {
                    await api("auth/logout", "POST");
                    User(null);
                    Editor(null);
                    ViewForm(false);
                    L([]);
                    V([]);
                  } catch (e) {
                    E(e.message);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </aside>
          <div className="workspace-main">
            <div className="workspace-heading">
              <div>
                <div className="eyebrow muted">YOUR BUSINESS, AT A GLANCE</div>
                <h2>
                  {tab === "overview"
                    ? "Welcome to your workspace."
                    : tab[0].toUpperCase() + tab.slice(1)}
                </h2>
                <p>
                  {tab === "overview"
                    ? "A little clarity for your next big move."
                    : "Keep everything moving, from one place."}
                </p>
              </div>
              {tab === "properties" && (
                <button
                  className="button dark"
                  onClick={() => Editor({ ...empty })}
                >
                  + Add property
                </button>
              )}
              {tab === "viewings" && (
                <button
                  className="button dark"
                  disabled={!properties.length}
                  onClick={() => ViewForm(true)}
                >
                  + Schedule viewing
                </button>
              )}
            </div>
            {tab === "profile" && (
              <Profile user={user} api={api} onUpdated={User} />
            )}
            {tab === "agents" && user.role === "admin" && <Agents api={api} />}
            {tab === "overview" && (
              <>
                <div className="stats">
                  {[
                    [
                      "Active properties",
                      properties.filter((p) => !p.archived).length,
                      "In your portfolio",
                    ],
                    [
                      "New enquiries",
                      leads.filter((l) => l.status === "New").length,
                      "Ready for a conversation",
                    ],
                    [
                      "Scheduled viewings",
                      viewings.filter((v) => v.status === "Scheduled").length,
                      "Make a good impression",
                    ],
                  ].map(([label, value, hint]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong>{String(value).padStart(2, "0")}</strong>
                      <small>{hint}</small>
                    </div>
                  ))}
                </div>
                <div className="overview-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>Latest enquiries</h3>
                      <button onClick={() => T("leads")}>View all ↗</button>
                    </div>
                    {leads.length ? (
                      leads.slice(0, 4).map((l) => (
                        <div className="activity" key={l.id}>
                          <span className="avatar">{l.name[0]}</span>
                          <div>
                            <strong>{l.name}</strong>
                            <small>{location(l.propertyId)}</small>
                          </div>
                          <span className={"status " + l.status.toLowerCase()}>
                            {l.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="empty compact">
                        Your next connection starts here.
                        <p>Property enquiries appear in this workspace.</p>
                      </div>
                    )}
                  </section>
                  <section className="panel green-panel">
                    <div className="eyebrow">MAKE YOUR NEXT MOVE</div>
                    <h3>
                      A great listing
                      <br />
                      opens doors.
                    </h3>
                    <p>
                      Put your properties in front of people looking for their
                      next home.
                    </p>
                    <button
                      className="button cream"
                      onClick={() => {
                        T("properties");
                        Editor({ ...empty });
                      }}
                    >
                      Add a property ↗
                    </button>
                  </section>
                </div>
              </>
            )}
            {tab === "properties" && (
              <section className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Price</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="table-property">
                            <img src={p.image} alt="" />
                            <div>
                              <strong>{p.title}</strong>
                              <small>{p.location}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {money(p.price)}
                          {p.purpose === "Rent" && <small> / year</small>}
                        </td>
                        <td>
                          <span className="status">
                            {p.archived
                              ? "Archived"
                              : "For " + p.purpose.toLowerCase()}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button onClick={() => Editor({ ...p })}>
                              Edit
                            </button>
                            <button
                              className="danger"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Archive this property? It will leave public search; client history will be kept.",
                                  )
                                )
                                  save(
                                    "properties/" + p.id,
                                    "DELETE",
                                    null,
                                    "Property archived",
                                  );
                              }}
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!properties.length && (
                  <div className="empty">
                    Add your first property to get started.
                  </div>
                )}
              </section>
            )}
            {tab === "leads" && (
              <section className="panel">
                {!leads.length ? (
                  <div className="empty">
                    <h3>No enquiries yet.</h3>
                    <p>Send a property enquiry to try the complete workflow.</p>
                    <button
                      className="button dark"
                      onClick={() => go("discover")}
                    >
                      Browse properties ↗
                    </button>
                  </div>
                ) : (
                  leads.map((l) => (
                    <article className="lead" key={l.id}>
                      <div className="lead-top">
                        <div>
                          <h3>{l.name}</h3>
                          <small>{location(l.propertyId)}</small>
                        </div>
                        <select
                          aria-label={"Lead status for " + l.name}
                          value={l.status}
                          disabled={busy}
                          onChange={(e) =>
                            save(
                              "leads/" + l.id,
                              "PUT",
                              { ...l, status: e.target.value },
                              "Lead updated",
                            )
                          }
                        >
                          {["New", "Contacted", "Closed"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <p>{l.message}</p>
                      <div className="lead-bottom">
                        <a href={"mailto:" + l.email}>{l.email}</a>
                        <a href={"tel:" + l.phone}>{l.phone}</a>
                        <small>
                          {new Date(l.createdAt).toLocaleDateString("en-NG")}
                        </small>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}
            {tab === "viewings" && (
              <section className="panel">
                {!viewings.length ? (
                  <div className="empty">
                    <h3>Make room for your next viewing.</h3>
                    <p>Schedule a property visit to fill your calendar.</p>
                  </div>
                ) : (
                  [...viewings]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((v) => (
                      <div className="viewing" key={v.id}>
                        <div className="date-tile">
                          <strong>
                            {new Date(v.date).toLocaleDateString("en-NG", {
                              day: "numeric",
                              timeZone: "Africa/Lagos",
                            })}
                          </strong>
                          <small>
                            {new Date(v.date).toLocaleDateString("en-NG", {
                              month: "short",
                              timeZone: "Africa/Lagos",
                            })}
                          </small>
                        </div>
                        <div>
                          <h3>{v.name}</h3>
                          <p>{location(v.propertyId)}</p>
                          <small>
                            {new Date(v.date).toLocaleString("en-NG", {
                              timeZone: "Africa/Lagos",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}{" "}
                            WAT
                          </small>
                        </div>
                        <select
                          aria-label={"Viewing status for " + v.name}
                          value={v.status}
                          disabled={busy}
                          onChange={(e) =>
                            save(
                              "viewings/" + v.id,
                              "PUT",
                              { ...v, status: e.target.value },
                              "Viewing updated",
                            )
                          }
                        >
                          {["Scheduled", "Completed", "Cancelled"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    ))
                )}
              </section>
            )}
          </div>
        </main>
      )}
      {page !== "dashboard" && (
        <footer>
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              go("discover");
            }}
          >
            homestead<span className="brand-dot">.</span>
          </a>
          <span>A better place to begin.</span>
          <small>
            © {new Date().getFullYear()} Homestead Nigeria · Development demo
          </small>
        </footer>
      )}
      {selected && (
        <Modal title="Property details" close={closeProperty}>
          <Gallery key={selected.id} property={selected} />
          <div className="detail-content">
            <span className="eyebrow muted">
              {selected.type} · FOR {selected.purpose.toUpperCase()}
            </span>
            <h1 className="property-heading">{selected.title}</h1>
            <p className="property-location">⌖ {selected.location}</p>
            <h3>
              {money(selected.price)}
              {selected.purpose === "Rent" && <small> / year</small>}
            </h3>
            <div className="property-specs">
              <span>{selected.beds} beds</span>
              <span>{selected.baths} baths</span>
              <span>{selected.area} m²</span>
            </div>
            <p>{selected.description}</p>
            <FeeBreakdown property={selected} money={money} />
            {selected.agent && (
              <div className="agent-contact">
                <div>
                  <strong>{selected.agent.name}</strong>
                  <p>Listing agent</p>
                </div>
                <a
                  className="button whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    "https://wa.me/" +
                    selected.agent.phone +
                    "?text=" +
                    encodeURIComponent(
                      "Hello, I’m interested in " +
                        selected.title +
                        " in " +
                        selected.location +
                        " listed on Homestead (" +
                        money(selected.price) +
                        "). Is it still available?",
                    )
                  }
                >
                  Chat on WhatsApp ↗
                </a>
              </div>
            )}
            <div className="demo-note">
              {selected.demo ? "Illustrative demo listing. " : ""}Verify
              availability, ownership, fees and title documents independently
              before a transaction.
            </div>
            <hr />
            {sent ? (
              <div className="success" role="status">
                <h3>Enquiry received.</h3>
                <p>Your enquiry is now in the agent workspace.</p>
                <button className="button dark" onClick={closeProperty}>
                  Keep exploring
                </button>
              </div>
            ) : (
              <>
                <h3>Picture yourself here?</h3>
                <p>Send an enquiry to the agent.</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const b = Object.fromEntries(new FormData(e.currentTarget));
                    if (
                      await save(
                        "leads",
                        "POST",
                        {
                          ...b,
                          propertyId: selected.id,
                          consent: b.consent === "on",
                        },
                        "Enquiry sent",
                      )
                    )
                      Sent(true);
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Your name
                      <input
                        name="name"
                        required
                        maxLength="100"
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                      />
                    </label>
                  </div>
                  <label>
                    Phone number
                    <input
                      name="phone"
                      type="tel"
                      required
                      maxLength="30"
                      autoComplete="tel"
                      placeholder="080…"
                    />
                  </label>
                  <label>
                    Message
                    <textarea
                      name="message"
                      required
                      maxLength="2000"
                      defaultValue="Hello, I’m interested in this property. Please share more details and available viewing times."
                    />
                  </label>
                  <label className="checkbox">
                    <input name="consent" type="checkbox" required />I agree to
                    share my contact details with this listing’s agent so they
                    can respond to my enquiry.
                  </label>
                  <button
                    className="button dark"
                    disabled={busy || !selected.agent}
                  >
                    {busy ? "Sending…" : "Send enquiry ↗"}
                  </button>
                  <small className="form-note">
                    {selected.agent
                      ? "The agent receives your enquiry in their workspace. No automated email or SMS is sent."
                      : "This demo listing has no assigned agent and is not accepting enquiries."}
                  </small>
                </form>
              </>
            )}
          </div>
        </Modal>
      )}
      {editor && user && (
        <Modal
          title={editor.id ? "Edit property" : "Add property"}
          close={() => Editor(null)}
        >
          <PropertyEditor
            editor={editor}
            user={user}
            api={api}
            busy={busy}
            onSave={async (b) => {
              if (
                await save(
                  "properties" + (editor.id ? "/" + editor.id : ""),
                  editor.id ? "PUT" : "POST",
                  b,
                  "Property saved",
                )
              )
                Editor(null);
            }}
          />
        </Modal>
      )}
      {viewForm && (
        <Modal title="Schedule viewing" close={() => ViewForm(false)}>
          <div className="detail-content">
            <div className="eyebrow muted">OPEN THE DOOR</div>
            <h2>Plan your next viewing.</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const b = Object.fromEntries(new FormData(e.currentTarget));
                b.date = new Date(b.date + ":00+01:00").toISOString();
                if (
                  await save(
                    "viewings",
                    "POST",
                    { ...b, status: "Scheduled" },
                    "Viewing scheduled",
                  )
                )
                  ViewForm(false);
              }}
            >
              <label>
                Client name
                <input name="name" required maxLength="100" />
              </label>
              <label>
                Property
                <select name="propertyId" required>
                  {properties
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — {p.location}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Date and time (Nigeria, WAT)
                <input
                  name="date"
                  type="datetime-local"
                  required
                  min={new Date(Date.now() + 3600000)
                    .toISOString()
                    .slice(0, 16)}
                />
              </label>
              <button className="button dark" disabled={busy}>
                {busy ? "Scheduling…" : "Schedule viewing ↗"}
              </button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
function Modal({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            close();
            return;
          }
          if (e.key !== "Tab") return;
          const nodes = [
              ...e.currentTarget.querySelectorAll(
                "button,input,select,textarea,a[href]",
              ),
            ].filter((n) => !n.disabled),
            first = nodes[0],
            last = nodes.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <button
          className="close-modal"
          onClick={close}
          aria-label="Close dialog"
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
