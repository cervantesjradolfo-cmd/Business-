// JumpJoy Party Rentals — demo interactions (no backend; everything runs in the browser).

// ---- Rental catalog (edit names, prices and details here) ----
const RENTALS = [
  { id: "sports", name: "Sports Arena Combo", type: "combo", ages: ["kids", "big"], img: "img/photo-sports.jpg", price: 199, size: "15' × 19'", cap: "Up to 10 kids", badge: "Most popular", rank: 1,
    desc: "A sporty bounce house with a built-in climb and slide. A backyard favorite.", features: ["Bounce + climb + slide", "Mesh windows so parents can watch", "Fits most backyards"] },
  { id: "carnival", name: "Carnival Mega Combo", type: "combo", ages: ["kids", "big"], img: "img/photo-hero.jpg", price: 249, size: "20' × 18'", cap: "Up to 12 kids", badge: "Best value", rank: 2,
    desc: "A big covered combo with a bounce floor, obstacles and a slide inside.", features: ["Covered roof for shade", "Inside obstacles + slide", "Great for mixed ages"] },
  { id: "bigslide", name: "Big Wave Slide", type: "water", ages: ["big"], img: "img/photo-bigslide.jpg", price: 279, size: "30' × 12'", cap: "1 slider at a time", badge: "Summer fave", rank: 3,
    desc: "A tall, fast slide that works wet or dry. The showstopper of any party.", features: ["Wet or dry use", "Tall double-lane slide", "Hose hookup included"] },
  { id: "dalmatian", name: "Dalmatian Fire House", type: "bounce", ages: ["toddler", "kids"], img: "img/photo-dalmatian.jpg", price: 159, size: "13' × 13'", cap: "Up to 8 kids", rank: 4,
    desc: "A fire-house themed bouncer with a little slide. Perfect for younger kids.", features: ["Gentle bounce for little ones", "Front slide exit", "Great for themed parties"] },
  { id: "giraffe", name: "Safari Giraffe Bouncer", type: "bounce", ages: ["kids"], img: "img/photo-giraffe.jpg", price: 169, size: "15' × 15'", cap: "Up to 10 kids", rank: 5,
    desc: "A bright safari bouncer with a big open jump floor.", features: ["Extra-large bounce floor", "Open sides for airflow", "Easy to watch from outside"] },
  { id: "jungle", name: "Jungle Obstacle Course", type: "obstacle", ages: ["big"], img: "img/photo-jungle.jpg", price: 329, size: "40' × 12'", cap: "2 racers at a time", rank: 6,
    desc: "Side-by-side racing lanes, pop-up obstacles and a slide finish.", features: ["Side-by-side racing lanes", "Great for schools & big groups", "Climb + slide finish"] },
];
const TYPE_LABEL = { bounce: "Bounce house", combo: "Combo", water: "Water slide", obstacle: "Obstacle course" };
const AGE_LABEL = { toddler: "Ages 1–4", kids: "Ages 3–10", big: "Ages 5+" };
const money = (n) => "$" + n.toLocaleString("en-US");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Small persistence helper (safe if storage is blocked) ----
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("jj:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("jj:" + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const state = {
  type: "all", age: "all", sort: "popular",
  favs: new Set(store.get("favs", [])),
  picked: new Set(store.get("picked", [])),
  tables: 0, extras: new Set(), hours: 6, miles: 10,
};

// ---- Toast ----
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---- Mobile menu & active nav ----
const menuBtn = $(".menu-btn"), navList = $("#nav-list");
menuBtn.addEventListener("click", () => {
  const open = navList.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
navList.addEventListener("click", (e) => {
  if (e.target.closest("a")) { navList.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
});
if ("IntersectionObserver" in window) {
  const links = $$(".nav-list a[href^='#']:not(.btn)");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((a) => { const sec = $(a.getAttribute("href")); if (sec) io.observe(sec); });
}

// ---- Availability checker (demo: pretend some weekend units are booked) ----
const today = new Date(); today.setHours(0, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10);
$("#avail-date").min = iso(today);
$("#f-date").min = iso(today);
$("#avail-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = $("#avail-date").value, out = $("#avail-result");
  out.className = "avail-result";
  if (!val) { out.textContent = "Pick a date first, then check."; out.classList.add("warn"); $("#avail-date").focus(); return; }
  const d = new Date(val + "T12:00:00");
  if (d < today) { out.textContent = "That date has passed. Pick an upcoming date."; out.classList.add("warn"); return; }
  const weekend = [0, 6].includes(d.getDay());
  const seed = [...val].reduce((a, c) => a + c.charCodeAt(0), 0);
  const booked = weekend ? 1 + (seed % 3) : seed % 2;
  const open = RENTALS.length - booked;
  const nice = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  out.textContent = `Good news! ${open} of ${RENTALS.length} rentals are open on ${nice}.` + (weekend ? " Weekends go fast, so book soon!" : "");
  out.classList.add("ok");
  $("#f-date").value = val;
});

// ---- Rentals grid ----
function card(r) {
  const fav = state.favs.has(r.id), added = state.picked.has(r.id);
  return `<article class="rental" data-id="${r.id}">
    ${r.badge ? `<span class="badge">${r.badge}</span>` : ""}
    <button class="fav" aria-pressed="${fav}" aria-label="${fav ? "Remove" : "Save"} ${r.name} ${fav ? "from" : "to"} favorites"><svg class="i"><use href="#i-heart"/></svg></button>
    <button class="rental-img" data-view aria-label="Quick view: ${r.name}"><img src="${r.img}" alt="${r.name}" loading="lazy" width="1200" height="900"><span class="qv-hint">Quick view</span></button>
    <div class="rental-body">
      <h3>${r.name}</h3>
      <ul class="meta"><li><svg class="i"><use href="#i-ruler"/></svg>${r.size}</li><li><svg class="i"><use href="#i-users"/></svg>${r.ages.map((a) => AGE_LABEL[a]).join(" · ")}</li></ul>
      <p>${r.desc}</p>
      <div class="rental-foot">
        <span class="price">${money(r.price)} <small>/ day</small></span>
        <button class="btn btn-ghost add-btn" data-add aria-pressed="${added}">${added ? '<svg class="i"><use href="#i-check"/></svg>Added' : '<svg class="i"><use href="#i-plus"/></svg>Add to party'}</button>
      </div>
    </div>
  </article>`;
}
function renderGrid() {
  let list = RENTALS.filter((r) => (state.type === "all" || r.type === state.type) && (state.age === "all" || r.ages.includes(state.age)));
  list.sort((a, b) => state.sort === "low" ? a.price - b.price : state.sort === "high" ? b.price - a.price : a.rank - b.rank);
  $("#rental-grid").innerHTML = list.length ? list.map(card).join("") :
    `<div class="empty"><h3>No rentals match those filters</h3><p>Try a different age or type.</p><button class="btn btn-ghost" id="reset-filters">Show all rentals</button></div>`;
  $("#result-count").textContent = `Showing ${list.length} rental${list.length === 1 ? "" : "s"}`;
}
$$(".chip").forEach((c) => c.addEventListener("click", () => {
  state.type = c.dataset.type;
  $$(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  renderGrid();
}));
$("#age-filter").addEventListener("change", (e) => { state.age = e.target.value; renderGrid(); });
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });

$("#rental-grid").addEventListener("click", (e) => {
  if (e.target.closest("#reset-filters")) {
    state.type = "all"; state.age = "all"; $("#age-filter").value = "all";
    $$(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.type === "all")));
    return renderGrid();
  }
  const el = e.target.closest(".rental"); if (!el) return;
  const r = RENTALS.find((x) => x.id === el.dataset.id);
  if (e.target.closest(".fav")) {
    state.favs.has(r.id) ? state.favs.delete(r.id) : state.favs.add(r.id);
    store.set("favs", [...state.favs]);
    toast(state.favs.has(r.id) ? `Saved ${r.name} to favorites` : `Removed ${r.name} from favorites`);
    renderGrid();
    $(`.rental[data-id="${r.id}"] .fav`)?.focus();
  } else if (e.target.closest("[data-add]")) {
    togglePick(r.id);
    $(`.rental[data-id="${r.id}"] [data-add]`)?.focus();
  } else if (e.target.closest("[data-view]")) {
    openQuickView(r);
  }
});

// ---- Party builder ----
function togglePick(id) {
  const r = RENTALS.find((x) => x.id === id);
  if (state.picked.has(id)) { state.picked.delete(id); toast(`Removed ${r.name}`); }
  else { state.picked.add(id); toast(`${r.name} added to your party!`); }
  store.set("picked", [...state.picked]);
  renderGrid(); renderBuilder();
}
function renderBuilder() {
  const picked = RENTALS.filter((r) => state.picked.has(r.id));
  $("#picked").innerHTML = picked.map((r) => `<li><img src="${r.img}" alt=""><span class="name">${r.name}</span><span class="p">${money(r.price)}</span>
    <button class="icon-btn" data-remove="${r.id}" aria-label="Remove ${r.name}"><svg class="i"><use href="#i-x"/></svg></button></li>`).join("");
  $("#picked-empty").hidden = picked.length > 0;

  const lines = picked.map((r) => [r.name, r.price]);
  if (state.tables) lines.push([`Tables & chairs × ${state.tables}`, state.tables * 15]);
  $$(".extra input[type=checkbox]").forEach((cb) => { if (cb.checked) lines.push([cb.closest("label").querySelector("strong").textContent, +cb.dataset.price]); });
  const extraHours = Math.max(0, state.hours - 6);
  if (extraHours && picked.length) lines.push([`Extra time (${extraHours} hr)`, extraHours * 25 * picked.length]);
  const deliveryFee = Math.max(0, state.miles - 15) * 2;
  lines.push(["Delivery & setup", deliveryFee]);
  const total = lines.reduce((a, [, p]) => a + p, 0);

  $("#lines").innerHTML = lines.map(([n, p]) => `<div><dt>${n}</dt><dd>${p === 0 ? "Free" : money(p)}</dd></div>`).join("");
  const totalEl = $("#total");
  if (totalEl.textContent !== money(total)) { totalEl.textContent = money(total); totalEl.classList.remove("bump"); void totalEl.offsetWidth; totalEl.classList.add("bump"); }

  const fab = $("#fab"), count = picked.length;
  fab.hidden = count === 0;
  $("#fab-count").textContent = count;
  fab.setAttribute("aria-label", `My party: ${count} rental${count === 1 ? "" : "s"}, ${money(total)} estimated`);
  fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump");

  const ps = $("#party-summary");
  ps.hidden = count === 0;
  ps.innerHTML = count ? `Your party (${money(total)} estimated):<ul>${lines.filter(([, p]) => p > 0).map(([n]) => `<li>${n}</li>`).join("")}</ul>` : "";
}
$("#picked").addEventListener("click", (e) => { const b = e.target.closest("[data-remove]"); if (b) togglePick(b.dataset.remove); });
$(".stepper").addEventListener("click", (e) => {
  const btns = $$(".stepper button");
  if (e.target.closest("button") === btns[0]) state.tables = Math.max(0, state.tables - 1);
  else if (e.target.closest("button") === btns[1]) state.tables = Math.min(20, state.tables + 1);
  else return;
  $(".stepper output").textContent = state.tables;
  renderBuilder();
});
$$(".extra input[type=checkbox]").forEach((cb) => cb.addEventListener("change", renderBuilder));
$("#hours").addEventListener("input", (e) => { state.hours = +e.target.value; $("#hours-out").textContent = `${state.hours} hours`; renderBuilder(); });
$("#miles").addEventListener("input", (e) => { state.miles = +e.target.value; $("#miles-out").textContent = `${state.miles} miles`; renderBuilder(); });

// ---- Quick view dialog ----
const qv = $("#quick-view");
let qvItem = null;
function openQuickView(r) {
  qvItem = r;
  $("#qv-img").src = r.img; $("#qv-img").alt = r.name;
  $("#qv-type").textContent = TYPE_LABEL[r.type];
  $("#qv-title").textContent = r.name;
  $("#qv-desc").textContent = r.desc;
  $("#qv-specs").innerHTML = [r.size + " footprint", r.cap, r.ages.map((a) => AGE_LABEL[a]).join(" · "), ...r.features]
    .map((f) => `<li><svg class="i"><use href="#i-check"/></svg>${f}</li>`).join("");
  $("#qv-price").innerHTML = `${money(r.price)} <small>/ day</small>`;
  updateQvButton();
  qv.showModal();
}
function updateQvButton() {
  const added = state.picked.has(qvItem.id);
  $("#qv-add").innerHTML = added ? '<svg class="i"><use href="#i-check"/></svg>Added to party' : '<svg class="i"><use href="#i-plus"/></svg>Add to party';
}
$("#qv-add").addEventListener("click", () => { togglePick(qvItem.id); updateQvButton(); });

// ---- Gallery lightbox ----
const lb = $("#lightbox");
$$(".shot").forEach((s) => s.addEventListener("click", () => {
  $("#lb-img").src = s.dataset.src; $("#lb-img").alt = s.querySelector("img").alt;
  $("#lb-cap").textContent = s.dataset.caption;
  lb.showModal();
}));

// Close dialogs via buttons or backdrop click
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

// ---- Reviews carousel ----
const slides = $$("#slides .review");
let current = 0, playing = !reduceMotion, timer;
const dots = $("#dots");
slides.forEach((_, i) => {
  const b = document.createElement("button");
  b.setAttribute("aria-label", `Show review ${i + 1}`);
  b.addEventListener("click", () => { go(i); stop(); });
  dots.appendChild(b);
});
function go(i) {
  current = (i + slides.length) % slides.length;
  slides.forEach((s, k) => { s.hidden = k !== current; });
  $$("button", dots).forEach((b, k) => b.setAttribute("aria-current", String(k === current)));
}
function start() { clearInterval(timer); timer = setInterval(() => go(current + 1), 6000); }
function stop() {
  playing = false; clearInterval(timer);
  $("#pause").innerHTML = '<svg class="i"><use href="#i-play"/></svg>';
  $("#pause").setAttribute("aria-label", "Play auto-play");
}
$("#prev").addEventListener("click", () => { go(current - 1); stop(); });
$("#next").addEventListener("click", () => { go(current + 1); stop(); });
$("#pause").addEventListener("click", () => {
  if (playing) return stop();
  playing = true; start();
  $("#pause").innerHTML = '<svg class="i"><use href="#i-pause"/></svg>';
  $("#pause").setAttribute("aria-label", "Pause auto-play");
});
const car = $(".carousel");
car.addEventListener("mouseenter", () => clearInterval(timer));
car.addEventListener("mouseleave", () => { if (playing) start(); });
car.addEventListener("focusin", () => clearInterval(timer));
car.addEventListener("focusout", () => { if (playing) start(); });
go(0);
if (playing) start(); else stop();

// ---- Booking form ----
const form = $("#book-form");
const rules = {
  "f-name": (v) => v ? "" : "Please enter your name.",
  "f-phone": (v) => !v ? "Please enter a phone number." : v.replace(/\D/g, "").length < 10 ? "Enter a 10-digit phone number, like (555) 123-4567." : "",
  "f-email": (v) => !v ? "Please enter your email." : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter an email like name@example.com.",
  "f-date": (v) => !v ? "Pick your party date." : v < iso(today) ? "Pick a date in the future." : "",
};
function check(id) {
  const el = $("#" + id), msg = rules[id](el.value.trim());
  el.closest(".field").classList.toggle("invalid", !!msg);
  el.setAttribute("aria-invalid", String(!!msg));
  $("#" + id + "-err").textContent = msg;
  return !msg;
}
Object.keys(rules).forEach((id) => $("#" + id).addEventListener("blur", () => check(id)));
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const bad = Object.keys(rules).filter((id) => !check(id));
  if (bad.length) { $("#" + bad[0]).focus(); return; }
  const btn = $("#book-submit");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Sending…';
  setTimeout(() => {
    const status = $("#form-status");
    status.innerHTML = '<svg class="i"><use href="#i-check"/></svg>Thanks! Your request is in. We\'ll confirm within a few hours. (Demo: nothing was actually sent.)';
    status.hidden = false; status.focus();
    btn.disabled = false;
    btn.innerHTML = '<svg class="i"><use href="#i-calendar"/></svg>Send Booking Request';
    form.reset();
  }, 900);
});

$("#year").textContent = new Date().getFullYear();
renderGrid();
renderBuilder();
