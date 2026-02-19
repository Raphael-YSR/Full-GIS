/* ═══════════════════════════════════════════════════
   TWWDA — Homepage JavaScript
   Sections: Sticky Header · Mobile Menu · Hero Slider
   ═══════════════════════════════════════════════════ */

/* ════════════════════════════════════
   STICKY HEADER + SEARCH REVEAL
   ════════════════════════════════════ */
const header = document.getElementById("site-header");
const desktopSearch = document.getElementById("desktop-search");

window.addEventListener("scroll", () => {
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
    if (window.innerWidth >= 1024) desktopSearch.style.display = "block";
  } else {
    header.classList.remove("scrolled");
    if (window.innerWidth >= 1024) desktopSearch.style.display = "block";
    else desktopSearch.style.display = "none";
  }
});

function syncSearch() {
  desktopSearch.style.display = window.innerWidth >= 1024 ? "block" : "none";
}
syncSearch();
window.addEventListener("resize", syncSearch);

/* ════════════════════════════════════
   MOBILE MENU
   ════════════════════════════════════ */
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileMenuClose = document.getElementById("mobile-menu-close");

function openMenu() {
  mobileMenu.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeMenu() {
  mobileMenu.classList.remove("open");
  document.body.style.overflow = "";
}

mobileMenuBtn.addEventListener("click", openMenu);
mobileMenuClose.addEventListener("click", closeMenu);
mobileMenu.addEventListener("click", (e) => {
  if (e.target === mobileMenu) closeMenu();
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mobileMenu.classList.contains("open")) closeMenu();
});

/* ════════════════════════════════════
   HERO SLIDER
   ════════════════════════════════════ */
const slides = document.querySelectorAll(".hero-slide");
const indicators = document.querySelectorAll(".indicator");
const heroImages = document.querySelector(".hero-images");

const eyebrowEl = document.getElementById("cardEyebrow");
const titleEl = document.getElementById("cardTitle");
const descEl = document.getElementById("cardDescription");
const counterEl = document.getElementById("slideCounter");

const slideContent = [
  {
    eyebrow: "Building Tomorrow",
    title: "Transforming Lives Through Water",
    description:
      "Leading Kenya's water infrastructure revolution with innovative solutions that bring clean, safe water to communities across five counties.",
  },
  {
    eyebrow: "Strategic Partnership",
    title: "Delivering Excellence Together",
    description:
      "Collaborating with government and communities to create sustainable water systems that drive economic growth and improve quality of life.",
  },
  {
    eyebrow: "Expert Leadership",
    title: "Guided by Vision & Experience",
    description:
      "Our Board of Directors brings decades of expertise in water management, ensuring every project meets the highest standards.",
  },
  {
    eyebrow: "Environmental Care",
    title: "Protecting Our Water Sources",
    description:
      "Committed to sustainable practices that preserve vital water catchments while delivering essential infrastructure to communities.",
  },
  {
    eyebrow: "Innovation & Engineering",
    title: "Modern Solutions for Today",
    description:
      "Leveraging cutting-edge technology and engineering excellence to design water systems built for the future.",
  },
  {
    eyebrow: "Quality Infrastructure",
    title: "World-Class Treatment Facilities",
    description:
      "Investing in advanced water treatment technology to ensure every community receives clean, safe drinking water.",
  },
];

let current = 0;
let timer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function showSlide(n) {
  if (n >= slides.length) n = 0;
  if (n < 0) n = slides.length - 1;
  current = n;

  slides.forEach((s) => s.classList.remove("active"));
  indicators.forEach((i) => i.classList.remove("active"));
  slides[n].classList.add("active");
  indicators[n].classList.add("active");
  counterEl.textContent = `${pad(n + 1)} / ${pad(slides.length)}`;

  // Fade text out → swap → fade in
  [eyebrowEl, titleEl, descEl].forEach((el) => {
    el.style.transition = "opacity 0.25s";
    el.style.opacity = "0";
  });
  setTimeout(() => {
    const c = slideContent[n];
    eyebrowEl.textContent = c.eyebrow;
    titleEl.textContent = c.title;
    descEl.textContent = c.description;
    [eyebrowEl, titleEl, descEl].forEach((el) => {
      el.style.transition = "opacity 0.5s";
      el.style.opacity = "1";
    });
  }, 280);
}

function goToSlide(n) {
  showSlide(n);
  resetTimer();
}

function startTimer() {
  timer = setInterval(() => showSlide(current + 1), 7000);
}

function resetTimer() {
  clearInterval(timer);
  startTimer();
}

// Pause on hover
heroImages.addEventListener("mouseenter", () => clearInterval(timer));
heroImages.addEventListener("mouseleave", startTimer);

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") goToSlide(current - 1);
  if (e.key === "ArrowRight") goToSlide(current + 1);
});

// Expose goToSlide globally so inline onclick handlers work
window.goToSlide = goToSlide;

// Start
startTimer();
