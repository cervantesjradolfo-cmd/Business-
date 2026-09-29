// Benji's Jumpers — small progressive enhancements (site works without JS)
document.documentElement.classList.remove("no-js");

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links.classList.contains("is-open")) {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
}

// Reveal-on-scroll
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 50}ms`;
    io.observe(el);
  });
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

// Rentals filter
const filterBtns = document.querySelectorAll(".filter-btn");
const rentalItems = document.querySelectorAll("[data-category]");
const filterStatus = document.getElementById("filter-status");
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    let shown = 0;
    rentalItems.forEach((item) => {
      const match = cat === "all" || item.dataset.category === cat;
      item.hidden = !match;
      if (match) shown++;
    });
    if (filterStatus) filterStatus.textContent = `Showing ${shown} rental${shown === 1 ? "" : "s"}`;
  });
});

// Pre-select a rental in the contact form from ?rental=...
const rentalSelect = document.getElementById("rental");
const params = new URLSearchParams(location.search);
if (rentalSelect && params.get("rental")) {
  const wanted = params.get("rental");
  const opt = [...rentalSelect.options].find((o) => o.value === wanted);
  if (opt) rentalSelect.value = wanted;
}

// Booking form validation.
// NOTE: this form has no backend yet. To receive submissions by email, set the
// form's action to a service like Formspree (https://formspree.io) and remove
// the e.preventDefault() success block below.
const form = document.getElementById("booking-form");
if (form) {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = form.querySelector("#date");
  if (dateInput) dateInput.min = today;

  const setError = (field, msg) => {
    const wrap = field.closest(".field");
    const err = wrap.querySelector(".error");
    wrap.classList.toggle("has-error", Boolean(msg));
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg || "";
  };

  const validate = (field) => {
    const v = field.value.trim();
    if (field.required && !v) return "This field is required.";
    if (field.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter an email like name@example.com.";
    if (field.type === "tel" && v && v.replace(/\D/g, "").length < 10) return "Enter a 10-digit phone number.";
    if (field.type === "date" && v && v < today) return "Pick a date in the future.";
    return "";
  };

  form.querySelectorAll("input, select, textarea").forEach((f) => {
    f.addEventListener("blur", () => setError(f, validate(f)));
  });

  form.addEventListener("submit", (e) => {
    let firstInvalid = null;
    form.querySelectorAll("input, select, textarea").forEach((f) => {
      const msg = validate(f);
      setError(f, msg);
      if (msg && !firstInvalid) firstInvalid = f;
    });
    if (firstInvalid) {
      e.preventDefault();
      firstInvalid.focus();
      return;
    }
    if (!form.getAttribute("action")) {
      e.preventDefault();
      const status = document.getElementById("form-status");
      status.hidden = false;
      status.focus();
      form.reset();
    }
  });
}

// Footer year
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
