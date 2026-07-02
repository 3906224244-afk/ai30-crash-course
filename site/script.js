/* ========================================
   ai30.site — 交互逻辑
   ======================================== */

// ---- Day sequence: -3, -2, -1, 1, 2, 3, 4, 5 ----
const daySequence = [-3,-2,-1,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];
const totalDays   = daySequence.length;

const navItems    = document.querySelectorAll('.nav-item[data-day]');
const sections    = document.querySelectorAll('.content-section');
const prevBtn     = document.getElementById('prevBtn');
const nextBtn     = document.getElementById('nextBtn');
const progressText = document.getElementById('progressText');

let currentIndex = 0;  // starts at Day -3

function getSectionId(day) {
  return 'day' + day;  // day-3 → "day-3", day1 → "day1"
}

function navigateTo(day) {
  const index = daySequence.indexOf(day);
  if (index === -1) return;
  currentIndex = index;

  // Update sections
  sections.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(getSectionId(day));
  if (target) target.classList.add('active');

  // Update sidebar
  navItems.forEach(n => n.classList.remove('active'));
  const navTarget = document.querySelector(`.nav-item[data-day="${day}"]`);
  if (navTarget) navTarget.classList.add('active');

  // Update bottom nav buttons
  if (prevBtn) prevBtn.disabled = (currentIndex === 0);
  if (nextBtn) nextBtn.disabled = (currentIndex === daySequence.length - 1);

  // Update progress text
  if (progressText) {
    const displayDay = day < 0 ? `预备 ${Math.abs(day)}` : day;
    progressText.innerHTML = `Day <span>${displayDay}</span> / 30`;
  }

  // Scroll to top
  document.querySelector('.main').scrollTop = 0;
  window.scrollTo(0, 0);
}

function goPrev() {
  if (currentIndex > 0) {
    navigateTo(daySequence[currentIndex - 1]);
  }
}

function goNext() {
  if (currentIndex < daySequence.length - 1) {
    navigateTo(daySequence[currentIndex + 1]);
  }
}

// ---- Event Listeners ----

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const day = parseInt(item.dataset.day, 10);
    if (!isNaN(day)) navigateTo(day);
  });
});

if (prevBtn) prevBtn.addEventListener('click', goPrev);
if (nextBtn) nextBtn.addEventListener('click', goNext);

// ---- Copy Code Buttons ----
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const codeBlock = btn.closest('.code-block');
    const pre = codeBlock ? codeBlock.querySelector('pre') : null;
    if (!pre) return;

    navigator.clipboard.writeText(pre.textContent).then(() => {
      btn.textContent = '✓ 已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = pre.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = '✓ 已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 2000);
    });
  });
});

// ---- Answer Toggles ----
document.querySelectorAll('.answer-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    if (!answer || !answer.classList.contains('answer-content')) return;

    const isShown = answer.classList.toggle('show');
    btn.classList.toggle('shown', isShown);
    btn.textContent = isShown ? '▲ 隐藏答案' : '▼ 查看答案';
  });
});

// ---- Keyboard Navigation ----
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    goNext();
  } else if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    goPrev();
  }
});

// ---- Highlight.js (if loaded) ----
if (typeof hljs !== 'undefined') {
  document.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });
}

// ---- Init ----
navigateTo(-3);
