// Global State
let grammarQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let lives = 3;
let timer = null;
let timeLeft = 30;
let isAnswered = false;

let config = {
  category: 'all',
  count: 10,
  mode: 'standard', // standard, survival, bug
  shuffleQuestions: false,
  shuffleOptions: false,
  useTimer: false
};

const mainContent = document.getElementById('main-content');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Theme Management
const applyTheme = (isDark) => {
  if (isDark) {
    document.body.classList.add('dark-mode');
    if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="ph ph-sun theme-toggle-icon"></i>';
  } else {
    document.body.classList.remove('dark-mode');
    if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="ph ph-moon theme-toggle-icon"></i>';
  }
};

const toggleTheme = () => {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  applyTheme(isDark);
};

if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  applyTheme(savedTheme === 'dark');
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  applyTheme(true);
}

const app = document.getElementById('app');

const categoryMap = {
  'cau-tao-tu': 'Cấu tạo từ',
  'danh-tu': 'Danh từ',
  'gioi-tu': 'Giới từ',
  'lien-tu': 'Liên từ',
  'dai-tu': 'Đại từ',
  'dong-tu': 'Động từ',
  'tinh-tu-trang-tu': 'Tính từ - Trạng từ',
  'menh-de-quan-he': 'Mệnh đề quan hệ',
  'cau-bi-dong': 'Câu bị động',
  'thoi-thi': 'Thời thì',
  'cau-dieu-kien': 'Câu điều kiện'
};

const getCategoryName = (key) => {
  if (key === 'all') return "Tổng hợp (Mix tất cả)";
  return categoryMap[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '));
};

const renderSetup = () => {
  if (timer) clearInterval(timer);
  
  const categories = Object.keys(window.TOEIC_DATA);
  
  let html = `
    <header class="app-header">
      <div class="logo">
        <img src="./logo.png" style="width: 28px; height: 28px; border-radius: 4px;" alt="Logo">
        <h1>TOEIC Master</h1>
      </div>
      <nav class="nav-links">
         <a href="index.html">Trang chủ</a>
         <a href="#" class="active" onclick="renderSetup()">Ngữ pháp</a>
         <a href="tips.html">Mẹo TOEIC</a>
         <a href="index.html?view=vault">Sniper Vault</a>
         <a href="index.html?view=manual">Hướng dẫn</a>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button id="theme-toggle-btn" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center; background:none; border:none; cursor:pointer;" onclick="toggleTheme()"><i class="ph ${document.body.classList.contains('dark-mode') ? 'ph-sun' : 'ph-moon'} theme-toggle-icon"></i></button>
      </nav>
    </header>
    
    <main class="container">
      <div class="hero" style="text-align:center; margin-bottom:3rem;">
        <h2 style="font-size:2rem; margin-bottom:0.5rem; color:var(--text-main);">Luyện Ngữ Pháp TOEIC</h2>
        <p style="font-size:1.05rem; color:var(--text-muted);">Hệ thống câu hỏi trắc nghiệm ngữ pháp phân loại theo chủ đề.</p>
      </div>
      
      <h3 class="section-title">Chủ đề Ngữ Pháp</h3>
      <div class="grid">
  `;

  // Render Mix Tất Cả Card
  html += `
    <div class="card" style="border: 2px solid var(--primary-color);">
      <div class="card-header">
        <h3 class="card-title">Mix tất cả</h3>
      </div>
      <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">Luyện tập tổng hợp từ tất cả các chủ đề hiện có.</p>
      <button class="btn btn-primary" style="margin-top:auto;" onclick="openGrammarSetup('all')">
        <i class="ph ph-play"></i> Bắt đầu Luyện
      </button>
    </div>
  `;

  // Render individual category cards
  categories.forEach(cat => {
    let totalQs = window.TOEIC_DATA[cat] ? window.TOEIC_DATA[cat].length : 0;
    html += `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${getCategoryName(cat)}</h3>
        </div>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">Số lượng: ${totalQs} câu</p>
        <button class="btn btn-outline" style="margin-top:auto;" onclick="openGrammarSetup('${cat}')">
          <i class="ph ph-play"></i> Luyện ngay
        </button>
      </div>
    `;
  });

  html += `</div></main>`;

  // Setup Modal Overlay
  html += `
    <div class="modal-overlay" id="grammar-setup-modal">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title" id="modal-title-cat">Cài đặt luyện tập</div>
          <i class="ph ph-x modal-close" onclick="closeGrammarSetup()"></i>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <input type="hidden" id="setup-category" value="all">
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-weight:600; margin-bottom:0.75rem; color:var(--text-main);">Số lượng câu hỏi</label>
            <select id="setup-count" class="select-box" style="width:100%;">
              <option value="10">10 câu</option>
              <option value="20">20 câu</option>
              <option value="30">30 câu</option>
              <option value="40">40 câu</option>
              <option value="50">50 câu</option>
              <option value="full">Full (Tất cả)</option>
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-weight:600; margin-bottom:0.75rem; color:var(--text-main);">Chế độ chơi</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
              <label class="checkbox-item" style="align-items:flex-start;">
                <input type="radio" name="setup-mode" value="standard" checked style="margin-top:0.15rem;">
                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                  <span style="font-weight:600; color:var(--text-main);">Tiêu chuẩn</span>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:400; line-height:1.2;">Luyện bình thường.</span>
                </div>
              </label>
              <label class="checkbox-item" style="align-items:flex-start;">
                <input type="radio" name="setup-mode" value="survival" style="margin-top:0.15rem;">
                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                  <span style="font-weight:600; color:var(--text-main);">Sinh tồn</span>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:400; line-height:1.2;">Sai 3 lần là out.</span>
                </div>
              </label>
              <label class="checkbox-item" style="align-items:flex-start; grid-column: 1 / -1;">
                <input type="radio" name="setup-mode" value="bug" style="margin-top:0.15rem;">
                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                  <span style="font-weight:600; color:var(--text-main);">Sửa Bug</span>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:400; line-height:1.2;">Tìm và sửa từ viết sai ngữ pháp.</span>
                </div>
              </label>
            </div>
          </div>

          <div style="margin-bottom: 0;">
            <label style="display:block; font-weight:600; margin-bottom:0.75rem; color:var(--text-main);">Tuỳ chọn thêm</label>
            <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
              <label class="checkbox-item" style="font-size:0.95rem; padding:0.4rem 0.6rem;">
                <input type="checkbox" id="setup-shuffle-questions" checked> Trộn câu hỏi
              </label>
              <label class="checkbox-item" style="font-size:0.95rem; padding:0.4rem 0.6rem;">
                <input type="checkbox" id="setup-shuffle-options" checked> Trộn đáp án
              </label>
              <label class="checkbox-item" style="font-size:0.95rem; padding:0.4rem 0.6rem;">
                <input type="checkbox" id="setup-timer"> Hẹn giờ 30s/câu
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeGrammarSetup()">Hủy</button>
          <button class="btn btn-primary" onclick="startPractice()">Bắt đầu luyện</button>
        </div>
      </div>
    </div>
  `;

  app.innerHTML = html;
  applyTheme(document.body.classList.contains('dark-mode'));
};

window.openGrammarSetup = (category) => {
  document.getElementById('setup-category').value = category;
  document.getElementById('modal-title-cat').innerText = `Cài đặt: ${getCategoryName(category)}`;
  const modal = document.getElementById('grammar-setup-modal');
  modal.classList.add('active');
};

window.closeGrammarSetup = () => {
  const modal = document.getElementById('grammar-setup-modal');
  modal.classList.remove('active');
};

const shuffleArray = (array) => {
  let curId = array.length;
  while (0 !== curId) {
    let randId = Math.floor(Math.random() * curId);
    curId -= 1;
    let tmp = array[curId];
    array[curId] = array[randId];
    array[randId] = tmp;
  }
  return array;
};

window.showToast = (title, msg, isError = false) => {
  let toast = document.createElement('div');
  toast.className = 'toast-notification show';
  if (isError) toast.style.borderLeftColor = 'var(--error)';
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <i class="ph ${isError ? 'ph-warning-circle' : 'ph-check-circle'}" style="font-size:1.5rem; color:${isError ? 'var(--error)' : 'var(--success)'};"></i>
      <div>
        <strong style="color:var(--text-main);">${title}</strong><br>
        <span style="font-size:0.9em; color:var(--text-muted);">${msg}</span>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.remove('show'), 2700);
  setTimeout(() => toast.remove(), 3000);
};

window.startPractice = () => {
  config.category = document.getElementById('setup-category').value;
  config.count = document.getElementById('setup-count').value;
  config.mode = document.querySelector('input[name="setup-mode"]:checked').value;
  config.shuffleQuestions = document.getElementById('setup-shuffle-questions').checked;
  config.shuffleOptions = document.getElementById('setup-shuffle-options').checked;
  config.useTimer = document.getElementById('setup-timer').checked;

  let allQ = [];
  if (config.category === 'all') {
    Object.values(window.TOEIC_DATA).forEach(arr => {
      allQ = allQ.concat(arr);
    });
  } else {
    allQ = [...window.TOEIC_DATA[config.category]];
  }

  if (config.shuffleQuestions) {
    allQ = shuffleArray(allQ);
  }

  let limit = config.count === 'full' ? allQ.length : parseInt(config.count, 10);
  grammarQuestions = allQ.slice(0, limit);

  grammarQuestions = grammarQuestions.map(q => {
    let lines = q.term.split('\n');
    let text = lines[0];
    
    let options = [];
    for(let i=1; i<lines.length; i++) {
       let m = lines[i].match(/^([A-D])\.\s+(.*)/);
       if(m) {
          options.push({ letter: m[1], text: m[2] });
       }
    }
    
    if (options.length === 0) {
       options = [
          { letter: 'A', text: 'N/A' },
          { letter: 'B', text: 'N/A' },
          { letter: 'C', text: 'N/A' },
          { letter: 'D', text: 'N/A' },
       ];
    }

    let correctLetter = q.definition.trim().toUpperCase();
    let correctOpt = options.find(o => o.letter === correctLetter) || options[0];
    
    let bugText = text;
    let wrongOptions = options.filter(o => o.letter !== correctLetter);
    if (config.mode === 'bug') {
       let wrongChoice = wrongOptions.length > 0 ? wrongOptions[Math.floor(Math.random() * wrongOptions.length)].text : "BuggyWord";
       bugText = text.replace(/…+|_+|\.{2,}/g, `<span class="bug-word">${wrongChoice}</span>`);
    } else {
       bugText = text.replace(/…+|_+|\.{2,}/g, `__________`);
    }

    let displayOptions = [...options];
    if (config.shuffleOptions) {
       displayOptions = shuffleArray(displayOptions);
       displayOptions.forEach((opt, idx) => {
          opt.displayLetter = String.fromCharCode(65 + idx);
       });
    } else {
       displayOptions.forEach(opt => {
          opt.displayLetter = opt.letter;
       });
    }

    return {
      original: q,
      text: text,
      displayHtml: bugText,
      options: displayOptions,
      correctOriginalLetter: correctLetter,
      correctDisplayLetter: displayOptions.find(o => o.letter === correctLetter)?.displayLetter || 'A',
      explain: q.explain
    };
  });

  currentQuestionIndex = 0;
  score = 0;
  lives = 3;
  isAnswered = false;
  
  document.addEventListener('keydown', handleKeyPress);
  
  renderAppSidebarLayout();
  renderQuestion();
};

const renderAppSidebarLayout = () => {
  const html = `
    <header class="app-header">
      <div class="logo" style="cursor:pointer;" onclick="quitPractice()">
        <i class="ph ph-arrow-left"></i>
        <span>Về trang chủ</span>
      </div>
      <div style="display:flex; align-items:center; gap:1.5rem;">
         <button onclick="document.getElementById('app-sidebar').classList.toggle('collapsed')" style="padding:0.4rem 0.75rem; border:1px solid rgba(255,255,255,0.3); border-radius:var(--radius-sm); background:transparent; color:white; font-weight:600; cursor:pointer;"><i class="ph ph-list"></i> Menu</button>
         <span style="font-weight:600; color:white; font-size:0.95rem;">Luyện Ngữ Pháp - ${getCategoryName(config.category)}</span>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button onclick="toggleTheme()" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center; background:none; border:none; cursor:pointer;"><i class="ph ${document.body.classList.contains('dark-mode') ? 'ph-sun' : 'ph-moon'} theme-toggle-icon"></i></button>
      </div>
    </header>
    <div class="practice-layout">
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <span>Danh sách câu hỏi</span>
          <button onclick="document.getElementById('app-sidebar').classList.add('collapsed')" style="cursor:pointer; color:var(--text-muted);"><i class="ph ph-x"></i></button>
        </div>
        <div class="sidebar-list" id="sidebar-list" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; align-content: flex-start; padding: 1rem;">
          <!-- Will be filled by renderPalette -->
        </div>
      </aside>
      <main class="main-area" id="main-area" style="position:relative;">
        <div id="question-area"></div>
      </main>
    </div>
  `;
  app.innerHTML = html;
  renderPalette();
};

const renderPalette = () => {
  const container = document.getElementById('sidebar-list');
  if(!container) return;
  
  let pHtml = '';
  grammarQuestions.forEach((q, idx) => {
    let stateClass = '';
    if (idx === currentQuestionIndex) stateClass = 'active';
    else if (q.answered) {
      // In main.css, palette-btn uses "done" class for answered questions, but "correct" or "incorrect" isn't standard in palette-btn. 
      // I'll reuse "done" and maybe add a small color hint via inline styles or custom class.
      stateClass = q.isCorrect ? 'done correct' : 'done incorrect';
    }
    pHtml += `
      <div class="palette-btn ${stateClass}" onclick="goToQuestion(${idx})" style="${q.answered ? (q.isCorrect ? 'border-color:var(--success); color:var(--success);' : 'border-color:var(--error); color:var(--error);') : ''}">${idx + 1}</div>
    `;
  });
  container.innerHTML = pHtml;
};

window.goToQuestion = (idx) => {
  // Can only jump to answered questions or next unanswered in standard mode.
  // In survival, jumping is disabled.
  if (config.mode === 'survival' && idx > currentQuestionIndex) return; 
  
  if (timer) clearInterval(timer);
  currentQuestionIndex = idx;
  isAnswered = !!grammarQuestions[idx].answered;
  renderQuestion();
};

const handleKeyPress = (e) => {
  if (isAnswered) return;
  const key = e.key.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(key)) {
    submitAnswer(key);
  }
};

const startTimer = () => {
  if (timer) clearInterval(timer);
  timeLeft = 30;
  updateTimerDisplay();
  
  timer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timer);
      handleTimeOut();
    }
  }, 1000);
};

const updateTimerDisplay = () => {
  const tEl = document.getElementById('timer-display-text');
  const tIcon = document.getElementById('timer-display-icon');
  if (tEl && tIcon) {
    tEl.innerText = `${timeLeft}s`;
    if (timeLeft <= 5) {
      tEl.style.color = '#ef4444';
      tIcon.style.color = '#ef4444';
    } else {
      tEl.style.color = '#f59e0b';
      tIcon.style.color = '#f59e0b';
    }
  }
};

const handleTimeOut = () => {
  if (isAnswered) return;
  submitAnswer('TIMEOUT');
};

const renderQuestion = () => {
  if (currentQuestionIndex >= grammarQuestions.length || (config.mode === 'survival' && lives <= 0)) {
    renderResults();
    return;
  }

  const q = grammarQuestions[currentQuestionIndex];
  isAnswered = !!q.answered;
  
  // Update stats banner
  const statsBanner = document.getElementById('stats-banner');
  if(statsBanner) {
    statsBanner.innerHTML = `
      <div style="display:flex; gap:1.5rem;">
        <span style="color:var(--text-main);"><i class="ph ph-list-numbers"></i> Câu ${currentQuestionIndex + 1}/${grammarQuestions.length}</span>
        ${config.useTimer ? `<span style="display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-clock" id="timer-display-icon" style="color:#f59e0b;"></i> <span id="timer-display-text" style="color:#f59e0b;">30s</span></span>` : ''}
        ${config.mode === 'survival' ? `<span style="color:#ef4444;"><i class="ph ph-heart-break"></i> ${lives} mạng</span>` : ''}
      </div>
      <div style="color:#10b981;"><i class="ph ph-star"></i> Điểm: ${score}</div>
    `;
  }

  let optionsHtml = q.options.map(opt => {
    let disabled = isAnswered ? 'disabled' : '';
    let isSelected = isAnswered && opt.displayLetter === q.selectedLetter;
    
    // Determine color classes for answered state
    let labelColor = 'var(--text-main)';
    let fw = '400';
    if (isAnswered) {
      if (opt.displayLetter === q.correctDisplayLetter) {
        labelColor = 'var(--success)';
        fw = '600';
      } else if (opt.displayLetter === q.selectedLetter) {
        labelColor = 'var(--error)';
      }
    }
    
    return `
      <label style="display:flex; align-items:center; gap:0.75rem; cursor:${isAnswered ? 'default' : 'pointer'}; color:${labelColor}; font-weight:${fw}; font-size:1.1rem; transition:all 0.2s;" id="lbl-${opt.displayLetter}">
        <input type="radio" name="grammar-q" value="${opt.displayLetter}" onclick="submitAnswer('${opt.displayLetter}')" ${disabled} ${isSelected ? 'checked' : ''} style="width:1.1rem; height:1.1rem; cursor:${isAnswered ? 'default' : 'pointer'}; accent-color:var(--primary);">
        <span>${opt.displayLetter}. ${opt.text}</span>
      </label>
    `;
  }).join('');

  let html = `
    <div class="panel" style="margin-bottom: 2rem;">
      <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:var(--text-main);"><i class="ph ph-list-numbers"></i> Câu ${currentQuestionIndex + 1}/${grammarQuestions.length}</span>
        <div style="display:flex; gap:1.5rem;">
          ${config.useTimer ? `<span style="display:flex; align-items:center; gap:0.25rem;"><i class="ph ph-clock" id="timer-display-icon" style="color:#f59e0b;"></i> <span id="timer-display-text" style="color:#f59e0b;">30s</span></span>` : ''}
          ${config.mode === 'survival' ? `<span style="color:#ef4444;"><i class="ph ph-heart-break"></i> ${lives} mạng</span>` : ''}
          <div style="color:var(--primary);"><i class="ph ph-star"></i> Điểm: ${score}</div>
        </div>
      </div>
      <div class="panel-body" style="padding: 1.5rem;">
        <div style="display:flex; align-items:flex-start; gap:0.75rem; margin-bottom:1.5rem;">
          <div style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:500; color:var(--text-main); font-size:0.95rem; background:var(--surface); margin-top:0.15rem;">${currentQuestionIndex + 1}</div>
          <div class="question-text" style="font-size: 1.15rem; font-weight:500; line-height:1.6; color:var(--text-main);">${q.displayHtml}</div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom: 2rem; margin-left: 0.25rem;">
          ${optionsHtml}
        </div>
        <div id="explanation-area" style="margin-top: 1rem;">
          ${isAnswered ? generateExplanationHtml(q, q.isCorrect) : ''}
        </div>
        
        <div class="control-bar" id="control-bar" style="${isAnswered ? 'display:flex; justify-content:flex-end; margin-top:1.5rem;' : 'display:none; justify-content:flex-end; margin-top:1.5rem;'}">
          <button class="btn btn-primary" onclick="nextQuestion()">Tiếp theo <i class="ph ph-arrow-right"></i></button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('question-area').innerHTML = html;
  renderPalette();
  
  if (config.useTimer && !isAnswered) {
    startTimer();
  }
};

const generateExplanationHtml = (q, isCorrect) => {
  let statusText = isCorrect ? 'Chính xác!' : (q.selectedLetter === 'TIMEOUT' ? 'Hết giờ!' : 'Sai rồi!');
  let expClass = isCorrect ? '' : 'wrong-ans';
  return `
    <div class="explanation-card ${expClass}">
      <strong>${statusText}</strong>
      <div style="margin-top: 0.5rem;">
        Đáp án đúng là: <strong>${q.correctDisplayLetter}</strong>
        ${q.explain ? `<br><br><em>Giải thích:</em> ${q.explain}` : ''}
      </div>
    </div>
  `;
}

window.submitAnswer = (selectedLetter) => {
  if (isAnswered) return;
  isAnswered = true;
  if (timer) clearInterval(timer);
  
  const q = grammarQuestions[currentQuestionIndex];
  const isCorrect = selectedLetter === q.correctDisplayLetter;
  
  q.answered = true;
  q.isCorrect = isCorrect;
  q.selectedLetter = selectedLetter;

  // Highlight options
  q.options.forEach(opt => {
    const radio = document.querySelector(`input[value="${opt.displayLetter}"]`);
    const label = document.getElementById(`lbl-${opt.displayLetter}`);
    if (radio) radio.disabled = true;
    if (label) {
      label.style.cursor = 'default';
      if (opt.displayLetter === q.correctDisplayLetter) {
        label.style.color = 'var(--success)';
        label.style.fontWeight = '600';
      } else if (opt.displayLetter === selectedLetter) {
        label.style.color = 'var(--error)';
      }
    }
  });

  if (isCorrect) {
    score++;
  } else {
    if (config.mode === 'survival') {
      lives--;
    }
  }

  // Show explanation
  const expArea = document.getElementById('explanation-area');
  expArea.innerHTML = generateExplanationHtml(q, isCorrect);
  document.getElementById('control-bar').style.display = 'flex';
  
  renderPalette();
};

window.nextQuestion = () => {
  if (config.mode === 'survival' && lives <= 0) {
    renderResults();
    return;
  }
  currentQuestionIndex++;
  renderQuestion();
};

window.quitPractice = () => {
  const modalHtml = `
    <div class="modal-overlay active" id="quit-confirm-modal" style="z-index: 10000;">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Xác nhận thoát</div>
          <i class="ph ph-x modal-close" onclick="document.getElementById('quit-confirm-modal').remove()"></i>
        </div>
        <div class="modal-body" style="color:var(--text-main);">
          Bạn có chắc chắn muốn thoát? Kết quả luyện tập hiện tại sẽ không được lưu.
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('quit-confirm-modal').remove()">Hủy</button>
          <button class="btn btn-primary" style="background:var(--error); border-color:var(--error);" onclick="document.getElementById('quit-confirm-modal').remove(); window.doQuitPractice();">Thoát</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.doQuitPractice = () => {
  document.removeEventListener('keydown', handleKeyPress);
  if (timer) clearInterval(timer);
  renderSetup();
};

const renderResults = () => {
  document.removeEventListener('keydown', handleKeyPress);
  if (timer) clearInterval(timer);
  
  const percentage = Math.round((score / grammarQuestions.length) * 100) || 0;
  
  let msg = "Tuyệt vời!";
  if (percentage < 50) msg = "Cần cố gắng hơn!";
  if (config.mode === 'survival' && lives <= 0) msg = "Game Over! Đã hết mạng.";

  const html = `
    <header class="app-header">
      <div class="logo">
        <img src="./logo.png" style="width: 28px; height: 28px; border-radius: 4px;" alt="Logo">
        <h1>TOEIC Master</h1>
      </div>
      <nav class="nav-links">
         <a href="index.html">Trang chủ</a>
         <a href="#" class="active" onclick="renderSetup()">Ngữ pháp</a>
         <a href="index.html?view=vault">Sniper Vault</a>
         <a href="index.html?view=manual">Hướng dẫn</a>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button id="theme-toggle-btn" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center; background:none; border:none; cursor:pointer;" onclick="toggleTheme()"><i class="ph ${document.body.classList.contains('dark-mode') ? 'ph-sun' : 'ph-moon'} theme-toggle-icon"></i></button>
      </nav>
    </header>
    <main class="container">
      <div class="card results-card" style="margin: 0 auto; max-width: 600px; text-align: center; padding: 3rem 2rem;">
        <h2 style="color:var(--text-main);">Kết quả Luyện tập</h2>
        <p style="margin-bottom: 2rem; color: var(--text-muted);">${msg}</p>
        
        <div class="score-circle" style="width: 150px; height: 150px; border-radius: 50%; border: 8px solid var(--primary); display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 0 auto 2rem; font-size: 2.5rem; font-weight: bold; color: var(--primary);">
          ${score}
          <span style="font-size: 1rem; font-weight: normal; color: var(--text-main);">/ ${grammarQuestions.length}</span>
        </div>
        
        <div class="results-stats" style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem;">
          <div class="result-stat-item" style="background: var(--surface-hover); padding: 1rem 1.5rem; border-radius: 8px;">
            <div style="font-size: 0.9em; color:var(--text-muted); margin-bottom: 0.25rem;">Tỉ lệ đúng</div>
            <div style="font-size: 1.5rem; color: var(--primary); font-weight: 600;">${percentage}%</div>
          </div>
          <div class="result-stat-item" style="background: var(--surface-hover); padding: 1rem 1.5rem; border-radius: 8px;">
            <div style="font-size: 0.9em; color:var(--text-muted); margin-bottom: 0.25rem;">Chế độ</div>
            <div style="font-size: 1.2rem; color: var(--primary); font-weight: 600; text-transform: capitalize;">${config.mode}</div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: center; gap: 1rem;">
          <button class="btn btn-outline" onclick="renderSetup()">Trang chính</button>
          <button class="btn btn-primary" onclick="startPractice()">Chơi lại ngay</button>
        </div>
      </div>
    </main>
  `;
  app.innerHTML = html;
};

// Start
document.addEventListener('DOMContentLoaded', () => {
  renderSetup();
});
