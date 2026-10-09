import React, { useEffect, useState } from "react";
export const feeTypes = [
  ["agency", "Agency fee"],
  ["legal", "Legal / agreement fee"],
  ["caution", "Caution deposit"],
  ["service", "Service charge"],
];
const initialFees = () =>
  Object.fromEntries(
    feeTypes.map(([key]) => [
      key,
      {
        amount: 0,
        frequency: key === "service" ? "annual" : "once",
        refundable: key === "caution",
      },
    ]),
  );
export function AuthForm({ api, onSignedIn }) {
  const [register, R] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState("");
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <div className="eyebrow muted">YOUR BUSINESS HAS A HOME HERE</div>
        <h1>
          Good spaces.
          <br />
          <em>Better connections.</em>
        </h1>
        <p>
          Keep your properties, enquiries and viewings together in your own
          agent workspace.
        </p>
      </div>
      <section className="auth-card">
        <div className="search-tabs">
          <button
            className={!register ? "selected" : ""}
            onClick={() => {
              R(false);
              E("");
            }}
          >
            Sign in
          </button>
          <button
            className={register ? "selected" : ""}
            onClick={() => {
              R(true);
              E("");
            }}
          >
            Create account
          </button>
        </div>
        <div className="detail-content">
          <h2>{register ? "Start your next chapter." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create your agent account."
              : "Sign in to manage your business."}
          </p>
          <form
            key={String(register)}
            onSubmit={async (e) => {
              e.preventDefault();
              B(true);
              E("");
              const b = Object.fromEntries(new FormData(e.currentTarget));
              try {
                const r = await api(
                  "auth/" + (register ? "register" : "login"),
                  "POST",
                  b,
                );
                onSignedIn(r.user);
              } catch (e) {
                E(e.message);
              } finally {
                B(false);
              }
            }}
          >
            {register && (
              <>
                <label>
                  Your full name
                  <input
                    name="name"
                    required
                    maxLength="100"
                    autoComplete="name"
                  />
                </label>
                <label>
                  WhatsApp number
                  <input
                    name="phone"
                    aria-label="WhatsApp number"
                    aria-describedby="signup-phone-note"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="08012345678"
                  />
                  <small id="signup-phone-note">
                    Use a Nigerian mobile number you receive WhatsApp messages
                    on.
                  </small>
                </label>
              </>
            )}
            <label>
              Email address
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                aria-label="Password"
                aria-describedby={register ? "signup-password-note" : undefined}
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength="128"
                autoComplete={register ? "new-password" : "current-password"}
              />
              {register && (
                <small id="signup-password-note">
                  Use at least 12 characters.
                </small>
              )}
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="button dark" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Create agent account ↗"
                  : "Sign in ↗"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
export function Profile({ user, api, onUpdated }) {
  const [busy, B] = useState(false),
    [notice, N] = useState("");
  return (
    <section className="panel detail-content">
      <h3>Your agent profile</h3>
      <p>Your name and WhatsApp number appear on your listings.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          B(true);
          N("");
          try {
            const r = await api(
              "account",
              "PUT",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            onUpdated(r.user);
            N("Profile saved.");
          } catch (e) {
            N(e.message);
          } finally {
            B(false);
          }
        }}
      >
        <label>
          Full name
          <input
            name="name"
            required
            maxLength="100"
            defaultValue={user.name}
          />
        </label>
        <label>
          WhatsApp number
          <input
            name="phone"
            type="tel"
            required
            defaultValue={"+" + user.phone}
          />
        </label>
        <p>{user.email}</p>
        <button className="button dark" disabled={busy}>
          Save profile
        </button>
        {notice && <p role="status">{notice}</p>}
      </form>
    </section>
  );
}
export function Agents({ api }) {
  const [users, U] = useState([]),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  async function load() {
    try {
      U(await api("users"));
    } catch (e) {
      E(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel detail-content">
      <h3>Agent accounts</h3>
      <p>
        Suspending an agent signs them out and hides their listings from the
        public catalogue.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {users.map((u) => (
        <div className="activity" key={u.id}>
          <div>
            <strong>
              {u.name} · {u.role}
            </strong>
            <small>{u.email}</small>
            <small>{u.active ? "Active" : "Suspended"}</small>
          </div>
          {u.role !== "admin" && (
            <button
              className="button small"
              disabled={busy}
              onClick={async () => {
                if (
                  !u.active ||
                  confirm("Suspend this agent and hide their listings?")
                ) {
                  B(true);
                  try {
                    await api("users/" + u.id, "PUT", { active: !u.active });
                    await load();
                  } catch (e) {
                    E(e.message);
                  } finally {
                    B(false);
                  }
                }
              }}
            >
              {u.active ? "Suspend" : "Reactivate"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
export function FeeBreakdown({ property, money }) {
  const fees = property.fees || initialFees(),
    rows = feeTypes
      .map(([key, label]) => [label, fees[key]])
      .filter(([, f]) => f && f.amount > 0),
    total = property.price + rows.reduce((s, [, f]) => s + f.amount, 0);
  return (
    <section className="fees-summary">
      <h3>Know the full cost.</h3>
      <div className="fee-row">
        <span>
          {property.purpose === "Rent" ? "Annual rent" : "Purchase price"}
        </span>
        <strong>{money(property.price)}</strong>
      </div>
      {rows.map(([label, f]) => (
        <div className="fee-row" key={label}>
          <span>
            {label}
            <small>
              {f.frequency === "once"
                ? "Paid once"
                : f.frequency === "annual"
                  ? "Annual payment"
                  : "Monthly payment"}
              {f.refundable ? " · Refundable" : ""}
            </small>
          </span>
          <strong>{money(f.amount)}</strong>
        </div>
      ))}
      <div className="fee-row total">
        <span>Total initial payment</span>
        <strong>{money(total)}</strong>
      </div>
      <p className="form-note">
        Includes the first payment of each listed recurring charge.{" "}
        {rows.length
          ? "Ask the agent to confirm all terms and any additional costs."
          : "No additional fees have been listed. Confirm all charges with the agent."}
      </p>
    </section>
  );
}
export function Gallery({ property }) {
  const photos = property.images?.length ? property.images : [property.image],
    [index, I] = useState(0);
  return (
    <div className="gallery">
      <img
        className="detail-image"
        src={photos[index]}
        alt={property.title + " — photo " + (index + 1)}
      />
      {photos.length > 1 && (
        <>
          <div className="gallery-controls">
            <button
              aria-label="Previous photo"
              onClick={() => I((index - 1 + photos.length) % photos.length)}
            >
              ←
            </button>
            <span>
              {index + 1} / {photos.length}
            </span>
            <button
              aria-label="Next photo"
              onClick={() => I((index + 1) % photos.length)}
            >
              →
            </button>
          </div>
          <div className="gallery-thumbs">
            {photos.map((url, i) => (
              <button
                key={url + i}
                className={i === index ? "chosen" : ""}
                aria-label={"Show photo " + (i + 1)}
                aria-pressed={i === index}
                onClick={() => I(i)}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
async function compress(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw Error("Choose JPEG, PNG or WebP photos under 15 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 25000000) {
    bitmap.close();
    throw Error("Photos must be under 25 megapixels.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
export function PropertyEditor({ editor, user, api, busy, onSave }) {
  const [images, I] = useState(
      editor.images?.length
        ? editor.images
        : editor.image
          ? [editor.image]
          : [],
    ),
    [fees, F] = useState({ ...initialFees(), ...editor.fees }),
    [uploading, U] = useState(false),
    [error, E] = useState(""),
    [users, Users] = useState([]);
  useEffect(() => {
    if (user.role === "admin")
      api("users")
        .then(Users)
        .catch((e) => E(e.message));
  }, []);
  function fee(key, field, value) {
    F({ ...fees, [key]: { ...fees[key], [field]: value } });
  }
  return (
    <div className="detail-content">
      <div className="eyebrow muted">BUILD YOUR PORTFOLIO</div>
      <h2>{editor.id ? "Edit your listing." : "A new address to discover."}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          E("");
          if (!images.length) {
            E("Upload at least one photo.");
            return;
          }
          const r = Object.fromEntries(new FormData(e.currentTarget));
          onSave({
            ...r,
            price: Number(r.price),
            beds: Number(r.beds),
            baths: Number(r.baths),
            area: Number(r.area),
            featured: r.featured === "on",
            archived: r.archived === "on",
            images,
            fees,
          });
        }}
      >
        <label>
          Listing title
          <input
            name="title"
            defaultValue={editor.title}
            required
            maxLength="150"
            placeholder="A welcoming home in Lekki"
          />
        </label>
        <div className="form-grid">
          <label>
            Location
            <input
              name="location"
              defaultValue={editor.location}
              required
              placeholder="Neighbourhood, city"
            />
          </label>
          <label>
            City
            <input name="city" defaultValue={editor.city} required />
          </label>
          <label>
            Property type
            <select
              aria-label="Property type"
              name="type"
              defaultValue={editor.type}
            >
              {[
                "Apartment",
                "Duplex",
                "Terrace",
                "Bungalow",
                "Land",
                "Commercial",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Purpose
            <select
              aria-label="Purpose"
              name="purpose"
              defaultValue={editor.purpose}
            >
              <option>Sale</option>
              <option>Rent</option>
            </select>
          </label>
          {[
            ["price", "Price (₦, annual for rent)"],
            ["area", "Area (m²)"],
            ["beds", "Bedrooms"],
            ["baths", "Bathrooms"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type="number"
                min={name === "price" ? 1 : 0}
                max={name === "price" ? 1e13 : undefined}
                required
                defaultValue={editor[name]}
              />
            </label>
          ))}
        </div>
        {user.role === "admin" && (
          <label>
            Listing agent
            <select name="ownerId" defaultValue={editor.ownerId || user.id}>
              {users
                .filter((u) => u.active)
                .map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
            <small>Enquiries and WhatsApp messages go to this agent.</small>
          </label>
        )}
        <fieldset className="photo-field">
          <legend>Property photos</legend>
          <p>
            Upload up to 12 photos. The first photo is the cover. Large images
            are compressed automatically.
          </p>
          <label className="upload-label">
            {uploading ? "Uploading photos…" : "Choose photos from your device"}
            <input
              aria-label="Upload property photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || images.length >= 12}
              onChange={async (e) => {
                const files = [...e.target.files];
                e.target.value = "";
                E("");
                if (images.length + files.length > 12) {
                  E("A listing can have up to 12 photos.");
                  return;
                }
                U(true);
                const added = [];
                try {
                  for (const file of files) {
                    const r = await api("uploads", "POST", {
                      data: await compress(file),
                    });
                    added.push(r.url);
                  }
                } catch (e) {
                  E(e.message);
                } finally {
                  I((current) => [...current, ...added]);
                  U(false);
                }
              }}
            />
          </label>
          <div className="photo-editor">
            {images.map((url, i) => (
              <div key={url + i}>
                <img src={url} alt={"Property photo " + (i + 1)} />
                {i === 0 ? (
                  <span className="cover-tag">Cover photo</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      I([url, ...images.filter((_, j) => j !== i)])
                    }
                  >
                    Make cover
                  </button>
                )}
                <div className="photo-actions">
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label={"Move photo " + (i + 1) + " earlier"}
                    onClick={() => {
                      const next = [...images];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      I(next);
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === images.length - 1}
                    aria-label={"Move photo " + (i + 1) + " later"}
                    onClick={() => {
                      const next = [...images];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      I(next);
                    }}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => I(images.filter((_, j) => j !== i))}
                    aria-label={"Remove photo " + (i + 1)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset className="fee-editor">
          <legend>Additional costs (₦)</legend>
          <p>
            Enter actual charges. Leave an amount at zero when it does not
            apply. Each amount represents one payment.
          </p>
          {feeTypes.map(([key, label]) => (
            <div className="fee-input" key={key}>
              <label>
                {label}
                <input
                  aria-label={label + " amount"}
                  type="number"
                  min="0"
                  max="10000000000000"
                  required
                  value={fees[key].amount}
                  onChange={(e) => fee(key, "amount", Number(e.target.value))}
                />
              </label>
              <label>
                Payment frequency
                <select
                  aria-label={label + " frequency"}
                  value={fees[key].frequency}
                  onChange={(e) => fee(key, "frequency", e.target.value)}
                >
                  <option value="once">Paid once</option>
                  <option value="annual">Annually</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  aria-label={label + " refundable"}
                  type="checkbox"
                  checked={fees[key].refundable}
                  onChange={(e) => fee(key, "refundable", e.target.checked)}
                />
                Refundable
              </label>
            </div>
          ))}
        </fieldset>
        <label>
          Description
          <textarea
            name="description"
            required
            maxLength="2000"
            defaultValue={editor.description}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={editor.featured}
          />
          Feature this property
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={editor.archived}
          />
          Archive listing (hide from public search)
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="button dark" disabled={busy || uploading}>
          {busy ? "Saving…" : "Save property ↗"}
        </button>
      </form>
    </div>
  );
}
