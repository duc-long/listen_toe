

const tests = testsData.map(t => ({
  id: t.id,
  title: `TOEIC Practice Test ${t.id}`,
  parts: t.parts,
  answers: t.answers || {}
}));

let practiceQueue = [];
let currentIndex = 0;
let hideMode = 0;
window.userAnswers = {};
window.userDictations = {};
let audioEl = null;
let bgmAudio = null;
let isPodcastMode = false;

// --- IndexedDB Logic ---
let db;
let dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('ToeicMasterDB', 2);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('sniper_vault')) {
      db.createObjectStore('sniper_vault', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('user_data')) {
      db.createObjectStore('user_data', { keyPath: 'type' });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    resolve(db);
  };
  request.onerror = (e) => reject(e);
});

window.saveUserData = async (type, data) => {
  const database = await dbPromise;
  const tx = database.transaction('user_data', 'readwrite');
  tx.objectStore('user_data').put({ type, data });
};

window.loadUserData = async (type) => {
  const database = await dbPromise;
  return new Promise((resolve) => {
    const tx = database.transaction('user_data', 'readonly');
    const request = tx.objectStore('user_data').get(type);
    request.onsuccess = () => resolve(request.result ? request.result.data : null);
    request.onerror = () => resolve(null);
  });
};

window.saveSnippetToVault = (snippet) => {
  if (!db) return;
  const tx = db.transaction('sniper_vault', 'readwrite');
  const store = tx.objectStore('sniper_vault');
  store.add({ ...snippet, createdAt: Date.now() });
};

window.getAllSnippets = (callback) => {
  if (!db) return;
  const tx = db.transaction('sniper_vault', 'readonly');
  const store = tx.objectStore('sniper_vault');
  const request = store.getAll();
  request.onsuccess = () => callback(request.result);
};

window.deleteSnippet = (id, callback) => {
  if (!db) return;
  const tx = db.transaction('sniper_vault', 'readwrite');
  const store = tx.objectStore('sniper_vault');
  const request = store.delete(id);
  request.onsuccess = () => { if(callback) callback(); };
};

window.renderHome = () => {
  if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); audioEl = null; }
  if (bgmAudio) { bgmAudio.pause(); bgmAudio.removeAttribute('src'); bgmAudio = null; }
  if (typeof vaultAudio !== 'undefined' && vaultAudio) { vaultAudio.pause(); }
  if (typeof vaultTimer !== 'undefined' && vaultTimer) { clearTimeout(vaultTimer); }
  isPodcastMode = false;
  
  const main = document.getElementById('app');
  let html = `
    <header class="app-header">
      <div class="logo">
        <img src="./logo.png" style="width: 28px; height: 28px; border-radius: 4px;" alt="Logo">
        <h1>TOEIC Master</h1>
      </div>
      <nav class="nav-links">
         <a href="#" class="active" onclick="window.renderHome()">Trang chủ</a>
         <a href="grammar.html">Ngữ pháp</a>
         <a href="#" onclick="window.renderVault()">Sniper Vault</a>
         <a href="#" onclick="window.renderManual()">Hướng dẫn</a>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button onclick="window.toggleTheme()" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center;"><i class="ph ${window.getThemeIcon()} theme-toggle-icon"></i></button>
      </nav>
    </header>
    <main class="container">
      <div class="hero" style="text-align:center; margin-bottom:3rem;">
        <h2 style="font-size:2rem; margin-bottom:0.5rem; color:var(--text-main);">Lộ trình Luyện nghe TOEIC</h2>
        <p style="font-size:1.05rem; color:var(--text-muted);">Giao diện luyện thi chuyên nghiệp. Hỗ trợ luyện theo Full Test hoặc luyện Chuyên Sâu từng Part.</p>
      </div>
      
      <h3 class="section-title">Luyện theo Test</h3>
      <div class="grid">
  `;

  tests.forEach(test => {
    html += `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${test.title}</h3>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:auto;">
          <button class="btn btn-primary" onclick="window.openTestModal(${test.id})">
            <i class="ph ph-play"></i> Bắt đầu làm Bài
          </button>
          <div style="display:flex; gap:0.25rem;">
             <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="window.startPodcast(${test.id}, 1)">🎧 P1</button>
             <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="window.startPodcast(${test.id}, 2)">🎧 P2</button>
             <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="window.startPodcast(${test.id}, 3)">🎧 P3</button>
             <button class="btn btn-outline" style="flex:1; font-size:0.85rem;" onclick="window.startPodcast(${test.id}, 4)">🎧 P4</button>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
      <h3 class="section-title" style="margin-top:2rem;">Luyện Chuyên Sâu (Intensive)</h3>
      <div class="grid">
  `;

  [1, 2, 3, 4].forEach(p => {
     html += `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Tất cả Part ${p}</h3>
        </div>
        <p style="color:var(--text-muted); font-size:0.9rem;">Gộp Part ${p} của cả 10 bài test để luyện chuyên sâu.</p>
        <button class="btn btn-outline" style="margin-top:auto;" onclick="window.startPractice('intensive', ${p})">
          <i class="ph ph-barbell"></i> Luyện ngay
        </button>
        ${p === 2 ? `<button class="btn btn-primary" style="margin-top:0.5rem;" onclick="window.openPart2CategoryModal()"><i class="ph ph-list-dashes"></i> Luyện theo Dạng</button>` : ''}
      </div>
     `;
  });

  html += `</div></main>
      <!-- Modal Overlay -->
      <div class="modal-overlay" id="test-modal">
         <div class="modal-box">
            <div class="modal-header">
               <div class="modal-title" id="modal-title">Chọn Phần Luyện Tập</div>
               <i class="ph ph-x modal-close" onclick="window.closeTestModal()"></i>
            </div>
            <div class="modal-body">
               <button class="btn btn-outline" id="modal-toggle-all" onclick="window.toggleAllParts()" style="width:100%; justify-content:center;">
                  <i class="ph ph-check-square"></i> Chọn / Bỏ chọn tất cả
               </button>
               <div class="checkbox-group" id="modal-checkboxes">
                  <label class="checkbox-item"><input type="checkbox" value="1" class="part-cb"> Phần 1 (Photographs)</label>
                  <label class="checkbox-item"><input type="checkbox" value="2" class="part-cb"> Phần 2 (Question-Response)</label>
                  <label class="checkbox-item"><input type="checkbox" value="3" class="part-cb"> Phần 3 (Conversations)</label>
                  <label class="checkbox-item"><input type="checkbox" value="4" class="part-cb"> Phần 4 (Talks)</label>
               </div>
            </div>
            <div class="modal-footer">
               <button class="btn btn-outline" onclick="window.closeTestModal()">Hủy</button>
               <button class="btn btn-primary" onclick="window.confirmTestModal()">Bắt đầu luyện tập</button>
            </div>
         </div>
      </div>
      
      <!-- Part 2 Category Modal Overlay -->
      <div class="modal-overlay" id="part2-category-modal">
         <div class="modal-box">
            <div class="modal-header">
               <div class="modal-title">Luyện Part 2 Theo Dạng</div>
               <i class="ph ph-x modal-close" onclick="window.closePart2CategoryModal()"></i>
            </div>
            <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
               <button class="btn btn-outline" onclick="window.toggleAllPart2Categories()" style="width:100%; justify-content:center; margin-bottom: 0.5rem;">
                  <i class="ph ph-check-square"></i> Chọn / Bỏ chọn tất cả
               </button>
               <div class="checkbox-group" id="part2-category-checkboxes">
                  <label class="checkbox-item"><input type="checkbox" value="wh" class="p2-cat-cb"> 1. WH Question</label>
                  <label class="checkbox-item"><input type="checkbox" value="yesno" class="p2-cat-cb"> 2. Yes/No Question</label>
                  <label class="checkbox-item"><input type="checkbox" value="choice" class="p2-cat-cb"> 3. Choice Question (or)</label>
                  <label class="checkbox-item"><input type="checkbox" value="suggestion" class="p2-cat-cb"> 4. Suggestion (Why don't we, Let's...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="request" class="p2-cat-cb"> 5. Request (Could you, Please...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="offer" class="p2-cat-cb"> 6. Offer (Can I, Shall I...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="invitation" class="p2-cat-cb"> 7. Invitation (Would you like to...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="opinion" class="p2-cat-cb"> 8. Opinion (What do you think...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="reason" class="p2-cat-cb"> 9. Reason / Why Question</label>
                  <label class="checkbox-item"><input type="checkbox" value="indirect" class="p2-cat-cb"> 10. Indirect Question (Do you know...)</label>
                  <label class="checkbox-item"><input type="checkbox" value="unknown" class="p2-cat-cb"> Dạng khác (Unknown)</label>
               </div>
            </div>
            <div class="modal-footer">
               <button class="btn btn-outline" onclick="window.closePart2CategoryModal()">Hủy</button>
               <button class="btn btn-primary" onclick="window.confirmPart2CategoryModal()">Bắt đầu luyện tập</button>
            </div>
         </div>
      </div>
  `;
  main.innerHTML = html;
};

let currentModalTestId = null;

window.openTestModal = (id) => {
   currentModalTestId = id;
   document.getElementById('modal-title').innerText = `Luyện tập Test ${id}`;
   document.querySelectorAll('.part-cb').forEach(cb => cb.checked = false);
   document.getElementById('test-modal').classList.add('active');
};

window.closeTestModal = () => {
   document.getElementById('test-modal').classList.remove('active');
};

window.toggleAllParts = () => {
   const cbs = Array.from(document.querySelectorAll('.part-cb'));
   const allChecked = cbs.every(cb => cb.checked);
   cbs.forEach(cb => cb.checked = !allChecked);
};

window.confirmTestModal = () => {
   let selectedParts = Array.from(document.querySelectorAll('.part-cb')).filter(cb => cb.checked).map(cb => parseInt(cb.value));
   if (selectedParts.length === 0) {
      selectedParts = [1, 2, 3, 4]; // Lấy hết nếu không chọn gì
      window.showToast("Thông báo", "Đã tự động chọn tất cả các Part để luyện tập.");
   }
   window.closeTestModal();
   window.startPractice('test', currentModalTestId, selectedParts);
};

window.categorizePart2Question = (engText) => {
  if (!engText) return 'unknown';
  let lines = engText.split('\n');
  let qText = '';
  for (let line of lines) {
    if (line.match(/^\([A-D]\)/)) break;
    qText += line + ' ';
  }
  qText = qText.replace(/^\d+[\.\s]*/, '').trim();

  if (/^(Do you know|Could you tell me|Do you happen to know|I was wondering)/i.test(qText)) return 'indirect';
  if (/^(What do you think|How do you feel|What's your opinion)/i.test(qText)) return 'opinion';
  if (/^(Would you like to|Do you want to|Can you join us)/i.test(qText)) return 'invitation';
  if (/^(Would you like me to|Can I|Shall I)/i.test(qText)) return 'offer';
  if (/^(Could you|Would you|Can you|Please)/i.test(qText)) return 'request';
  if (/^(Why don't we|Let's|How about|Shall we)/i.test(qText)) return 'suggestion';
  if (/\bor\b/i.test(qText)) return 'choice';
  if (/^Why\b/i.test(qText)) return 'reason';
  if (/^(What|Where|When|Who|Which|How)\b/i.test(qText)) return 'wh';
  if (/^(Is|Are|Do|Does|Did|Have|Has|Can|Will|Would)\b/i.test(qText)) return 'yesno';

  return 'unknown';
};

window.openPart2CategoryModal = () => {
   document.querySelectorAll('.p2-cat-cb').forEach(cb => cb.checked = false);
   document.getElementById('part2-category-modal').classList.add('active');
};

window.closePart2CategoryModal = () => {
   document.getElementById('part2-category-modal').classList.remove('active');
};

window.toggleAllPart2Categories = () => {
   const cbs = Array.from(document.querySelectorAll('.p2-cat-cb'));
   const allChecked = cbs.every(cb => cb.checked);
   cbs.forEach(cb => cb.checked = !allChecked);
};

window.confirmPart2CategoryModal = () => {
   let selectedCategories = Array.from(document.querySelectorAll('.p2-cat-cb')).filter(cb => cb.checked).map(cb => cb.value);
   if (selectedCategories.length === 0) {
      window.showToast("Cảnh báo", "Vui lòng chọn ít nhất một dạng để luyện tập.");
      return;
   }
   window.closePart2CategoryModal();
   window.startPractice('part2_category', null, selectedCategories);
};

window.startPractice = async (mode, id, selectedOptions = []) => {
  isPodcastMode = false;
  practiceQueue = [];
  window.userAnswers = await window.loadUserData('answers') || {};
  window.userDictations = await window.loadUserData('dictations') || {};
  
  if (mode === 'test') {
    const t = tests.find(x => x.id === id);
    t.parts.forEach(p => {
      if (selectedOptions.includes(p.id)) {
        p.groups.forEach(g => {
          practiceQueue.push({ testId: t.id, partId: p.id, group: g, answers: t.answers });
        });
      }
    });

  } else if (mode === 'intensive') {
    tests.forEach(t => {
      const p = t.parts.find(x => x.id === id);
      if (p) {
        p.groups.forEach(g => {
          practiceQueue.push({ testId: t.id, partId: p.id, group: g, answers: t.answers });
        });
      }
    });
  } else if (mode === 'part2_category') {
    tests.forEach(t => {
      const p = t.parts.find(x => x.id === 2);
      if (p) {
        p.groups.forEach(g => {
          const category = window.categorizePart2Question(g.eng);
          if (selectedOptions.includes(category)) {
            practiceQueue.push({ testId: t.id, partId: p.id, group: g, answers: t.answers, p2cat: category });
          }
        });
      }
    });
  }
  
  currentIndex = 0;
  if (practiceQueue.length === 0) {
     window.showToast("Thông báo", "Không có câu hỏi nào thuộc các dạng bạn đã chọn.");
     return;
  }
  renderLayout();
};

window.startPodcast = (testId, partId) => {
  isPodcastMode = true;
  practiceQueue = [];
  
  const t = tests.find(x => x.id === testId);
  const p = t.parts.find(x => x.id === partId);
  if (p) {
     p.groups.forEach(g => {
        practiceQueue.push({ testId: t.id, partId: p.id, group: g });
     });
  }
  
  currentIndex = 0;
  
  const main = document.getElementById('app');
  main.innerHTML = `
    <div class="podcast-layout">
       <div class="podcast-topbar">
          <div class="podcast-brand">
             <button class="btn btn-outline" onclick="window.renderHome()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
               <i class="ph ph-arrow-left"></i> Về trang chủ
             </button>
             <div style="border-left: 1px solid var(--border); height: 24px; margin: 0 0.5rem;"></div>
             <i class="ph ph-headphones" style="font-size:1.5rem; color:var(--primary);"></i>
             <div>
               <h1>Test ${testId} - Part ${partId}</h1>
               <p>Luyện Nghe Thụ Động • Nhạc nền Lofi</p>
             </div>
          </div>
       </div>
       
       <div class="podcast-scroll-area" id="podcast-scroll-container">
          <div class="podcast-container" id="podcast-transcript-area">
          </div>
       </div>
       
       <div class="podcast-player-bar">
          <div class="podcast-controls" style="display:flex; align-items:center; gap:0.5rem;">
             <button class="btn-play-circle" id="play-btn" onclick="window.togglePlay()"><i class="ph ph-pause"></i></button>
             <button class="btn btn-outline" style="padding:0.6rem; border-radius:4px; height:44px; display:flex; align-items:center; justify-content:center;" onclick="window.nextPodcast()"><i class="ph ph-skip-forward"></i></button>
          </div>
          
          <div class="podcast-progress">
             <span class="time-text" id="time-curr">00:00</span>
             <div class="progress-track" id="progress-bar-container" onclick="window.seekAudio(event)">
                <div class="progress-fill" id="progress-bar"></div>
             </div>
             <span class="time-text" id="time-tot">00:00</span>
          </div>
          
          <div style="display:flex; align-items:center; gap:1.5rem; border-left:1px solid var(--border); padding-left:1.5rem;">
             <div style="display:flex; flex-direction:column; align-items:center; gap:0.2rem;">
               <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;"><i class="ph ph-music-note"></i> BGM</span>
               <input type="range" min="0" max="1" step="0.05" value="0.3" oninput="window.changeBgmVolume(this.value)" style="width:70px; accent-color:var(--primary);" />
             </div>
             <div style="display:flex; flex-direction:column; align-items:center; gap:0.2rem;">
               <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;"><i class="ph ph-microphone"></i> Voice</span>
               <input type="range" min="0" max="1" step="0.05" value="1" oninput="window.changeVoiceVolume(this.value)" style="width:70px; accent-color:var(--primary);" />
             </div>
          </div>
       </div>
    </div>
  `;
  
  if(bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
  bgmAudio = new Audio(`./写在风中的信 - 解语花 - 纯音乐.mp3`);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.3;
  bgmAudio.play().catch(e => console.log('Autoplay blocked for BGM'));

  renderPodcastContent();
  playPodcastIndex(0);
};

window.changeBgmVolume = (val) => { if(bgmAudio) bgmAudio.volume = parseFloat(val); };
window.changeVoiceVolume = (val) => { if(audioEl) audioEl.volume = parseFloat(val); };

let isLiaisonOn = false;
let currentTranscriptTab = 'eng';
const stopWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "with", "about", "of", "by", "and", "but", "or", "so", "because", "if", "when", "while", "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could", "will", "would", "shall", "should", "may", "might", "must", "it", "he", "she", "they", "we", "you", "i", "me", "him", "her", "us", "them", "my", "your", "his", "their", "our", "this", "that", "these", "those", "here", "there", "what", "who", "where", "why", "how", "not", "no"]);

window.toggleLiaison = () => {
   isLiaisonOn = !isLiaisonOn;
   const btn = document.getElementById('liaison-btn');
   if (btn) {
      if (isLiaisonOn) btn.classList.add('active');
      else btn.classList.remove('active');
   }
   renderCurrentGroup();
   if (isPodcastMode) renderPodcastContent();
};

window.setHideMode = (mode) => {
   hideMode = parseInt(mode);
   renderCurrentGroup();
};

window.seekToWord = (el) => {
   if (!audioEl || !audioEl.duration) return;
   let prog = parseFloat(el.getAttribute('data-progress'));
   if (!isNaN(prog)) {
      let partId = 3;
      if (typeof practiceQueue !== 'undefined' && practiceQueue[currentIndex]) {
          partId = practiceQueue[currentIndex].partId;
      }
      
      let introOffset = 5;
      if (partId === 1) introOffset = 5.6;
      else if (partId === 2) introOffset = 1.0;
      
      const actualDuration = Math.max(0, audioEl.duration - introOffset);
      
      if (audioEl.duration < 5) {
         audioEl.currentTime = prog * audioEl.duration;
      } else {
         audioEl.currentTime = introOffset + (prog * actualDuration);
      }
      
      if (audioEl.paused) window.togglePlay();
   }
};

function processTranscript(text, isEnglish = false) {
  if (!text) return '';
  
  let totalSegmentWords = 1;
  if (isEnglish) {
     totalSegmentWords = text.split(/\s+/).filter(w => w.trim() && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(w)).length;
  }
  
  // Unwrap lines (OCR creates arbitrary line breaks)
  let rawLines = text.split('\n');
  let combinedLines = [];
  for(let i=0; i<rawLines.length; i++) {
     let l = rawLines[i].trim();
     if (!l) {
        combinedLines.push('');
        continue;
     }
     
     let isNewItem = /^(?:##\s*)?([MW][1-9]?|Nam(?: \d)?|Nữ(?: \d)?)(?:\^)?:\s*/i.test(l) ||
                     /^(\d{1,3}[\.\s])/.test(l) ||
                     /^(\([A-D]\))\s*/.test(l) ||
                     /^([A-D])\s+(?=[A-Z\p{Lu}Đ])/u.test(l);
     
     if (isNewItem || combinedLines.length === 0 || combinedLines[combinedLines.length - 1] === '') {
         combinedLines.push(l);
     } else {
         combinedLines[combinedLines.length - 1] += ' ' + l;
     }
  }

  let hiddenCount = 0;
  
  return combinedLines.map(line => {
    if (!line.trim()) return '<div style="height:0.5rem;"></div>';
    
    let prefixHTML = '';
    let content = line;
    
    // Clean up dictation markers if present
    content = content.replace(/##\s*/g, '').replace(/\^/g, '');
    
    let spkMatch = content.match(/^([MW][1-9]?|Nam(?: \d)?|Nữ(?: \d)?):\s*/i);
    if(spkMatch) {
       prefixHTML += `<span class="speaker-label">${spkMatch[1]}:</span> `;
       content = content.substring(spkMatch[0].length);
    }
    
    let qMatch = content.match(/^(\d{1,3}[\.\s])/);
    if(qMatch) {
       prefixHTML += `<span class="question-label">${qMatch[1].trim()}</span> `;
       content = content.substring(qMatch[0].length);
    }
    
    let optMatch = content.match(/^(\([A-D]\))\s*/);
    if(optMatch) {
       prefixHTML += `<span class="option-label">${optMatch[1]}</span> `;
       content = content.substring(optMatch[0].length);
    }
    
    let ansMatch = content.match(/^([A-D])\s+(?=[A-Z\p{Lu}Đ])/u);
    if(ansMatch) {
       prefixHTML += `<span class="answer-label">${ansMatch[1]}</span> `;
       content = content.substring(ansMatch[0].length);
    }
    
    let contentHTML = content;
    if (hideMode !== 0 || isEnglish) {
       const words = content.split(/(\s+)/);
       
       let hideSet = new Set();
       if (hideMode > 0 && isEnglish) {
          let cands = [];
          let prios = [];
          let fallbacks = [];
          let lastW = "";
          for(let i=0; i<words.length; i++) {
             let w = words[i];
             if (!w.trim()) continue;
             if (!/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(w) && w.length > 1) {
                let cleanLast = lastW.toLowerCase().replace(/[^a-z]/g, '');
                let cleanW = w.toLowerCase().replace(/[^a-z']/g, '');
                
                if (stopWords.has(cleanLast) && !stopWords.has(cleanW)) {
                   prios.push(i);
                } else if (!stopWords.has(cleanW)) {
                   cands.push(i);
                } else {
                   fallbacks.push(i);
                }
                lastW = w;
             }
          }
          
          let needed = hideMode;
          if (prios.length > 0) {
             let take = Math.min(needed, prios.length);
             let step = prios.length / take;
             for(let i=0; i<take; i++) hideSet.add(prios[Math.floor(i * step)]);
             needed -= take;
          }
          if (needed > 0 && cands.length > 0) {
             let take = Math.min(needed, cands.length);
             let step = cands.length / take;
             for(let i=0; i<take; i++) hideSet.add(cands[Math.floor(i * step)]);
             needed -= take;
          }
          if (needed > 0 && fallbacks.length > 0) {
             let take = Math.min(needed, fallbacks.length);
             let step = fallbacks.length / take;
             for(let i=0; i<take; i++) hideSet.add(fallbacks[Math.floor(i * step)]);
          }
       }

       contentHTML = words.map((word, i) => {
         if (!word.trim()) return word;
         
         let wordClass = "transcript-word";
         if (isEnglish) wordClass += " clickable";
         
         const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(word);
         if (isEnglish && !isVietnamese && word.length > 1) {
           if (hideMode === -1) { 
             wordClass += " hidden";
           } else if (hideMode > 0 && hideSet.has(i)) {
             wordClass += " hidden";
           } else if (hideMode === -2) {
             const cleanWord = word.toLowerCase().replace(/[^a-z']/g, '');
             if (stopWords.has(cleanWord)) {
               wordClass += " blurred";
             }
           }
           hiddenCount++;
         }
         
         let dataProgress = isEnglish ? `data-progress="${Math.max(0, hiddenCount - 1) / Math.max(1, totalSegmentWords)}"` : '';
         
         let liaisonSpan = '';
         if (isEnglish && isLiaisonOn) {
            let nextWord = words[i+2] ? words[i+2].trim() : '';
            if (nextWord) {
               let lastChar = word.toLowerCase().replace(/[^a-z]/g, '').slice(-1);
               let nextFirstChar = nextWord.toLowerCase().replace(/[^a-z]/g, '').charAt(0);
               let isConsonant = /[bcdfghjklmnpqrstvwxyz]/.test(lastChar);
               let isVowel = /[aeiou]/.test(nextFirstChar);
               if ((isConsonant && isVowel) || (['t','d'].includes(lastChar) && nextFirstChar === 'y')) {
                  liaisonSpan = '<span class="liaison">‿</span>';
               }
            }
         }
         
         return `<span class="${wordClass}" ${dataProgress} onclick="if(this.classList.contains('hidden')) { this.classList.remove('hidden'); event.stopPropagation(); } else if(this.classList.contains('blurred')) { this.classList.remove('blurred'); event.stopPropagation(); } else if(${isEnglish}) { window.seekToWord(this); }">${word}</span>${liaisonSpan}`;
       }).join('');
    }
    
    return `<div class="transcript-line">${prefixHTML}${contentHTML}</div>`;
  }).join('');
}

function renderPodcastContent() {
   const container = document.getElementById('podcast-transcript-area');
   let html = '';
   practiceQueue.forEach((item, idx) => {
      const data = item.group;
      let lbl = item.group.start === item.group.end ? item.group.start : item.group.start + '-' + item.group.end;
      html += `
         <div id="pod-group-${idx}" class="podcast-card">
            <h4 style="color:var(--primary); margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px dashed var(--border); padding-bottom:0.5rem;">CÂU ${lbl}</h4>
            <div style="display:flex; flex-direction:column; gap:2rem;">
               <div class="podcast-eng">
                  ${processTranscript(data.eng, true)}
               </div>
               <div class="podcast-vie">
                  ${processTranscript(data.vie, false)}
               </div>
            </div>
         </div>
      `;
   });
   container.innerHTML = html;
}

function playPodcastIndex(idx) {
   if (idx >= practiceQueue.length) {
       window.showToast("Hoàn thành", "Đã phát hết danh sách. Tự động lặp lại từ đầu!");
       idx = 0; // Tự động lặp lại từ đầu
   }
   currentIndex = idx;
   
   // update UI highlight
   document.querySelectorAll('.podcast-card').forEach(el => el.classList.remove('active'));
   const activeEl = document.getElementById(`pod-group-${idx}`);
   if(activeEl) {
      activeEl.classList.add('active');
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
   }

   const item = practiceQueue[idx];
   const tid = item.testId.toString().padStart(2, '0');
   const r0 = item.group.start;
   const r1 = item.group.end;
   let filename = r0 === r1 ? `E26-T${tid}-${r0.toString().padStart(2, '0')}.mp3` : `E26-T${tid}-${r0}-${r1}.mp3`;
   
   if(audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); }
   audioEl = new Audio(`./Audio/${filename}`);
   audioEl.autoplay = true;
   
   const playBtn = document.getElementById('play-btn');
   const progBar = document.getElementById('progress-bar');
   const tCurr = document.getElementById('time-curr');
   const tTot = document.getElementById('time-tot');
   
   if (playBtn) {
      audioEl.addEventListener('play', () => playBtn.innerHTML = '<i class="ph ph-pause"></i>');
      audioEl.addEventListener('pause', () => playBtn.innerHTML = '<i class="ph ph-play"></i>');
      audioEl.addEventListener('loadedmetadata', () => { tTot.textContent = formatTime(audioEl.duration); });
      audioEl.addEventListener('timeupdate', () => {
         if (!audioEl) return;
         tCurr.textContent = formatTime(audioEl.currentTime);
         if(audioEl.duration) {
             progBar.style.width = (audioEl.currentTime / audioEl.duration * 100) + '%';
         }
      });
      audioEl.addEventListener('ended', () => {
         playPodcastIndex(currentIndex + 1);
      });
   }
}

window.nextPodcast = () => {
   playPodcastIndex(currentIndex + 1);
};

// -------------------------------------------------------------
// Practice Mode Logic
// -------------------------------------------------------------

function renderLayout() {
  const main = document.getElementById('app');
  main.innerHTML = `
    <header class="app-header">
      <div class="logo" style="cursor:pointer;" onclick="window.renderHome()">
        <i class="ph ph-arrow-left"></i>
        <span>Về trang chủ</span>
      </div>
      <div style="display:flex; align-items:center; gap:1.5rem;">
         <button onclick="document.getElementById('app-sidebar').classList.toggle('collapsed')" style="padding:0.4rem 0.75rem; border:1px solid rgba(255,255,255,0.3); border-radius:var(--radius-sm); background:transparent; color:white; font-weight:600; cursor:pointer;"><i class="ph ph-list"></i> Toggle Menu</button>
         <span style="font-weight:600; color:white; font-size:0.95rem;">Câu hỏi hiện tại: ${currentIndex + 1} / ${practiceQueue.length}</span>
         <select class="select-box" onchange="window.setHideMode(parseInt(this.value))">
          <option value="0" ${hideMode===0?'selected':''}>Hiện 100% chữ</option>
          <option value="1" ${hideMode===1?'selected':''}>Ẩn 1 từ / câu</option>
          <option value="3" ${hideMode===3?'selected':''}>Ẩn 3 từ / câu</option>
          <option value="5" ${hideMode===5?'selected':''}>Ẩn 5 từ / câu</option>
          <option value="-1" ${hideMode===-1?'selected':''}>Ẩn toàn bộ</option>
          <option value="-2" ${hideMode===-2?'selected':''}>Bắt Keywords (Mờ)</option>
        </select>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button onclick="window.toggleTheme()" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center;"><i class="ph ${window.getThemeIcon()} theme-toggle-icon"></i></button>
      </div>
    </header>
    
    <div class="practice-layout">
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <span>Question Palette</span>
          <button onclick="document.getElementById('app-sidebar').classList.add('collapsed')" style="cursor:pointer; color:var(--text-muted);"><i class="ph ph-x"></i></button>
        </div>
        <div class="sidebar-list" id="sidebar-list">
        </div>
      </aside>
      <main class="main-area" id="main-area">
      </main>
    </div>
  `;
  
  renderSidebar();
  renderCurrentGroup();
}

function renderSidebar() {
  const list = document.getElementById('sidebar-list');
  let sbHTML = '';
  let lastTestId = null;
  
  practiceQueue.forEach((q, idx) => {
     if (q.testId !== lastTestId) {
        sbHTML += `<div style="width: 100%; margin-top:0.5rem; margin-bottom:0.25rem; font-size:0.8rem; color:var(--primary); font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.25rem;">Test ${q.testId}</div>`;
        lastTestId = q.testId;
     }
     
     let isDone = false;
     for(let i = q.group.start; i <= q.group.end; i++) {
        if(window.userAnswers[`${q.testId}_${i}`] || window.userDictations[`${q.testId}_${q.group.start}`]) isDone = true;
     }
     let lbl = q.group.start === q.group.end ? q.group.start : q.group.start + '-' + q.group.end;
     let catTooltip = q.p2cat ? ` [${q.p2cat}]` : '';
     sbHTML += `
       <div id="sb-item-${idx}" class="palette-btn ${idx === currentIndex ? 'active' : ''} ${isDone ? 'done' : ''}" onclick="window.jumpTo(${idx})" title="Test ${q.testId} - Part ${q.partId} | Q${lbl}${catTooltip}">
         ${lbl}
       </div>
     `;
  });
  list.innerHTML = sbHTML;
  
  const activeItem = document.querySelector('.palette-btn.active');
  if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

window.jumpTo = (idx) => {
  currentIndex = idx;
  renderSidebar();
  renderCurrentGroup();
};

window.selectAnswer = (qNum, option) => {
  const item = practiceQueue[currentIndex];
  const correctAnswer = item.answers[qNum];
  const key = `${item.testId}_${qNum}`;
  window.userAnswers[key] = option;
  window.saveUserData('answers', window.userAnswers);
  
  ['A', 'B', 'C', 'D'].forEach(opt => {
    const btn = document.getElementById(`btn-q${qNum}-${opt}`);
    if (!btn) return;
    btn.classList.remove('correct', 'incorrect', 'selected');
    if (opt === correctAnswer) {
      btn.classList.add('correct');
    } else if (opt === option) {
      btn.classList.add('incorrect');
    }
  });
  
  document.getElementById(`sb-item-${currentIndex}`).classList.add('done');
};

window.saveDictation = (val) => {
  const item = practiceQueue[currentIndex];
  const key = `${item.testId}_${item.group.start}`;
  window.userDictations[key] = val;
  window.saveUserData('dictations', window.userDictations);
  if (val.trim()) {
    document.getElementById(`sb-item-${currentIndex}`).classList.add('done');
  } else {
    document.getElementById(`sb-item-${currentIndex}`).classList.remove('done');
  }
};

window.switchTab = (group, tabName) => {
  if (group === 'text') currentTranscriptTab = tabName;
  document.querySelectorAll(`#panel-${group} .tab-btn`).forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`#panel-${group} .tab-pane`).forEach(c => c.classList.remove('active'));
  document.querySelector(`#panel-${group} .tab-btn[onclick*="'${tabName}'"]`).classList.add('active');
  document.getElementById(`pane-${group}-${tabName}`).classList.add('active');
};

function formatTime(secs) {
  if(isNaN(secs)) return "00:00";
  let m = Math.floor(secs / 60);
  let s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

window.togglePlay = () => {
  if (!audioEl) return;
  if (audioEl.paused) {
     audioEl.play();
     if(isPodcastMode && bgmAudio && bgmAudio.paused) bgmAudio.play();
  } else {
     audioEl.pause();
     if(isPodcastMode && bgmAudio) bgmAudio.pause();
  }
};

window.toggleLoop = () => {
  if (!audioEl) return;
  audioEl.loop = !audioEl.loop;
  const btn = document.getElementById('loop-btn');
  if (audioEl.loop) btn.classList.add('active');
  else btn.classList.remove('active');
};

window.changeSpeed = (speed) => {
  if (!audioEl) return;
  audioEl.playbackRate = parseFloat(speed);
};

window.seekAudio = (e) => {
  if (!audioEl) return;
  const bar = document.getElementById('progress-bar-container');
  const rect = bar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audioEl.currentTime = pct * audioEl.duration;
};

window.nextQuestion = () => {
  if(currentIndex < practiceQueue.length - 1) window.jumpTo(currentIndex + 1);
};
window.prevQuestion = () => {
  if(currentIndex > 0) window.jumpTo(currentIndex - 1);
};

function renderCurrentGroup() {
  const item = practiceQueue[currentIndex];
  const main = document.getElementById('main-area');
  
  const tid = item.testId.toString().padStart(2, '0');
  const r0 = item.group.start;
  const r1 = item.group.end;
  let filename = r0 === r1 ? `E26-T${tid}-${r0.toString().padStart(2, '0')}.mp3` : `E26-T${tid}-${r0}-${r1}.mp3`;
  
  let mcqHTML = '';
  for(let q = r0; q <= r1; q++) {
     mcqHTML += `
       <div class="mcq-q">
         <div class="mcq-q-label">Câu ${q}</div>
         <div class="mcq-opts">
           <button id="btn-q${q}-A" class="mcq-btn" onclick="window.selectAnswer(${q}, 'A')">A</button>
           <button id="btn-q${q}-B" class="mcq-btn" onclick="window.selectAnswer(${q}, 'B')">B</button>
           <button id="btn-q${q}-C" class="mcq-btn" onclick="window.selectAnswer(${q}, 'C')">C</button>
           <button id="btn-q${q}-D" class="mcq-btn" onclick="window.selectAnswer(${q}, 'D')">D</button>
         </div>
       </div>
     `;
  }
  
  const textData = item.group;
  let mainCatBadge = item.p2cat ? ` <br/><span style="font-size:0.8rem; color:var(--text-muted); font-weight:400; text-transform:uppercase;">[${item.p2cat}]</span>` : '';

  main.innerHTML = `
    <div class="audio-header">
       <div class="group-title">Test ${item.testId} - Part ${item.partId} <br/> Câu ${r0 === r1 ? r0 : r0+'-'+r1}${mainCatBadge}</div>
       
       <div class="audio-ctrl-btn" id="play-btn" onclick="window.togglePlay()" title="Phát/Tạm dừng (Ctrl + Space)"><i class="ph ph-play"></i></div>
       
       <div class="audio-progress-container">
          <span class="audio-time" id="time-curr">00:00</span>
          <div class="audio-progress" id="progress-bar-container" onclick="window.seekAudio(event)">
             <div class="audio-progress-bar" id="progress-bar"></div>
          </div>
          <span class="audio-time" id="time-tot">00:00</span>
       </div>
       
       <div class="audio-toggles">
          <button class="audio-toggle-btn" id="loop-btn" onclick="window.toggleLoop()" title="Lặp lại (Alt + L)"><i class="ph ph-repeat"></i></button>
          <button class="audio-toggle-btn ${isLiaisonOn ? 'active' : ''}" id="liaison-btn" onclick="window.toggleLiaison()" title="Phân tích Luyến âm"><i class="ph ph-link"></i></button>
          <select class="select-box" onchange="window.changeSpeed(this.value)">
             <option value="0.75">0.75x</option>
             <option value="1" selected>1.0x</option>
             <option value="1.25">1.25x</option>
             <option value="1.5">1.5x</option>
          </select>
       </div>
       
       <div style="display:flex; gap:0.5rem; margin-left:1rem; border-left:1px solid var(--border); padding-left:1rem;">
          <button class="btn btn-outline" style="padding:0.5rem;" onclick="window.prevQuestion()" ${currentIndex === 0 ? 'disabled' : ''} title="Câu trước (Alt + ←)"><i class="ph ph-caret-left"></i></button>
          <button class="btn btn-outline" style="padding:0.5rem;" onclick="window.nextQuestion()" ${currentIndex === practiceQueue.length - 1 ? 'disabled' : ''} title="Câu tiếp (Alt + →)"><i class="ph ph-caret-right"></i></button>
       </div>
    </div>
    
    <div class="content-grid">
      <!-- Left Column: Exercises -->
      <div class="panel" id="panel-exercise">
         <div class="panel-header">Luyện tập</div>
         <div class="panel-body">
            <h4 style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:1px;">Multiple Choice</h4>
            <div class="mcq-container">
               ${mcqHTML}
            </div>
            
            <h4 style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.75rem; margin-top:0.5rem; text-transform:uppercase; letter-spacing:1px;">Dictation</h4>
            <textarea class="dictation-area" placeholder="Nghe và chép lại vào đây..." onkeyup="window.saveDictation(this.value)">${window.userDictations[`${item.testId}_${r0}`] || ''}</textarea>
         </div>
      </div>
      
      <!-- Right Column: Transcripts -->
      <div class="panel" id="panel-text">
         <div class="tabs">
           <button class="tab-btn ${currentTranscriptTab === 'eng' ? 'active' : ''}" onclick="window.switchTab('text', 'eng')">Transcript (Eng)</button>
           <button class="tab-btn ${currentTranscriptTab === 'vie' ? 'active' : ''}" onclick="window.switchTab('text', 'vie')">Translation (Vie)</button>
         </div>
         <div id="pane-text-eng" class="tab-pane ${currentTranscriptTab === 'eng' ? 'active' : ''}">
            ${processTranscript(textData.eng, true)}
         </div>
         <div id="pane-text-vie" class="tab-pane ${currentTranscriptTab === 'vie' ? 'active' : ''}">
            ${processTranscript(textData.vie, false)}
         </div>
      </div>
    </div>
  `;
  
  if(audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); }
  audioEl = new Audio(`./Audio/${filename}`);
  audioEl.autoplay = true;
  
  const playBtn = document.getElementById('play-btn');
  const progBar = document.getElementById('progress-bar');
  const tCurr = document.getElementById('time-curr');
  const tTot = document.getElementById('time-tot');
  
  audioEl.addEventListener('play', () => playBtn.innerHTML = '<i class="ph ph-pause"></i>');
  audioEl.addEventListener('pause', () => playBtn.innerHTML = '<i class="ph ph-play"></i>');
  audioEl.addEventListener('loadedmetadata', () => { tTot.textContent = formatTime(audioEl.duration); });
  audioEl.addEventListener('timeupdate', () => {
     if (!audioEl) return;
     tCurr.textContent = formatTime(audioEl.currentTime);
     if(audioEl.duration) {
         progBar.style.width = (audioEl.currentTime / audioEl.duration * 100) + '%';
     }
  });
  audioEl.addEventListener('ended', () => {
     if(!audioEl.loop && currentIndex < practiceQueue.length - 1) {
         window.jumpTo(currentIndex + 1);
     }
  });

  for(let q = r0; q <= r1; q++) {
     const key = `${item.testId}_${q}`;
     if(window.userAnswers[key]) {
        window.selectAnswer(q, window.userAnswers[key]);
     }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('toeic_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');
  if (view === 'vault') {
    window.renderVault();
  } else if (view === 'manual') {
    window.renderManual();
  } else {
    window.renderHome();
  }
});

window.getThemeIcon = () => {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'ph-sun' : 'ph-moon';
};

window.toggleTheme = () => {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  root.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('toeic_theme', isDark ? 'light' : 'dark');
  
  const icons = document.querySelectorAll('.theme-toggle-icon');
  icons.forEach(icon => {
     icon.className = isDark ? 'ph ph-moon theme-toggle-icon' : 'ph ph-sun theme-toggle-icon';
  });
};

window.showToast = (title, msg, isError = false) => {
    let toast = document.createElement('div');
    toast.className = 'toast-notification';
    const color = isError ? 'var(--error)' : '#10b981';
    const icon = isError ? 'ph-warning-circle' : 'ph-check-circle';
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<i class="ph ${icon}" style="font-size:1.5rem; color:${color};"></i> <div><b>${title}</b><br><span style="font-size:0.85rem;">${msg}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
       toast.classList.remove('show');
       setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  // Prevent default behavior for specific combinations to avoid browser conflicts
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    if (window.togglePlay) window.togglePlay();
  }
  
  // Audio seeking (Ctrl + Left/Right)
  if (e.ctrlKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    if (audioEl && !isNaN(audioEl.currentTime)) {
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
    }
  }
  if (e.ctrlKey && e.key === 'ArrowRight') {
    e.preventDefault();
    if (audioEl && !isNaN(audioEl.currentTime)) {
      audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
    }
  }

  // Next/Prev Question (Alt + Left/Right)
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    if (window.prevQuestion) window.prevQuestion();
  }
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    if (window.nextQuestion) window.nextQuestion();
  }

  // Toggle Loop (Alt + L)
  if (e.altKey && e.code === 'KeyL') {
    e.preventDefault();
    if (window.toggleLoop) window.toggleLoop();
  }
  
  // Save to Sniper Vault (Ctrl + S)
  if (e.ctrlKey && (e.key === 's' || e.code === 'KeyS')) {
    e.preventDefault();
    if (!audioEl || audioEl.paused || !practiceQueue[currentIndex]) return;
    
    const cTime = audioEl.currentTime;
    const startT = Math.max(0, cTime - 1.5);
    const endT = Math.min(audioEl.duration || cTime + 3, cTime + 3);
    
    // Find transcript words in this time range
    const words = document.querySelectorAll('.transcript-word');
    let snippetWords = [];
    words.forEach(w => {
       let p = parseFloat(w.getAttribute('data-progress'));
       if (!isNaN(p)) {
          let t = p * audioEl.duration; 
          if (t >= startT - 1 && t <= endT + 1) {
             snippetWords.push(w.innerText);
          }
       }
    });
    const textSnippet = snippetWords.join(' ') || "Không trích xuất được text...";
    
    const item = practiceQueue[currentIndex];
    const tid = item.testId.toString().padStart(2, '0');
    const r0 = item.group.start;
    const r1 = item.group.end;
    let filename = r0 === r1 ? `E26-T${tid}-${r0.toString().padStart(2, '0')}.mp3` : `E26-T${tid}-${r0}-${r1}.mp3`;
    
    window.saveSnippetToVault({
       testId: item.testId,
       partId: item.partId,
       questionLabel: r0 === r1 ? r0 : r0 + '-' + r1,
       textSnippet: textSnippet,
       audioFile: `./Audio/${filename}`,
       startTime: startT,
       endTime: endT
    });
    
    // Show toast
    window.showToast('Thành công!', 'Đã lưu vào Sổ tay Điểm mù');
  }
});

// --- Sniper Vault UI ---
window.renderVault = () => {
  if (audioEl) { audioEl.pause(); audioEl = null; }
  if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
  if (typeof vaultAudio !== 'undefined' && vaultAudio) { vaultAudio.pause(); }
  if (typeof vaultTimer !== 'undefined' && vaultTimer) { clearTimeout(vaultTimer); }
  
  const main = document.getElementById('app');
  main.innerHTML = `
    <header class="app-header">
      <div class="logo">
        <i class="ph ph-headphones"></i>
        <h1>TOEIC Master</h1>
      </div>
      <nav class="nav-links">
         <a href="#" onclick="window.renderHome()">Trang chủ</a>
         <a href="grammar.html">Ngữ pháp</a>
         <a href="#" class="active" onclick="window.renderVault()">Sniper Vault</a>
         <a href="#" onclick="window.renderManual()">Hướng dẫn</a>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button onclick="window.toggleTheme()" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center;"><i class="ph ${window.getThemeIcon()} theme-toggle-icon"></i></button>
      </nav>
    </header>
    <main class="container">
      <div class="hero" style="text-align:center; margin-bottom:3rem;">
        <h2 style="font-size:2rem; margin-bottom:0.5rem; color:var(--primary);">Sổ tay Điểm mù (Sniper Vault) 🎯</h2>
        <p style="font-size:1.05rem; color:var(--text-muted);">Nghe đi nghe lại các đoạn Audio 3 giây gây "lú" nhất mà bạn đã trích xuất.</p>
      </div>
      <div class="grid" id="vault-grid">
         <div style="text-align:center; width:100%; color:var(--text-muted);">Đang tải dữ liệu...</div>
      </div>
    </main>
  `;
  
  window.getAllSnippets((snippets) => {
    const grid = document.getElementById('vault-grid');
    if (snippets.length === 0) {
       grid.innerHTML = `<div style="text-align:center; width:100%; grid-column: 1 / -1; padding: 4rem; background:var(--surface); border-radius:12px; border:1px dashed var(--border);">
         <i class="ph ph-empty" style="font-size:4rem; color:var(--border);"></i>
         <h3 style="color:var(--text-muted); margin-top:1rem;">Chưa có điểm mù nào được lưu</h3>
         <p style="color:var(--text-muted); font-size:0.9rem;">Bấm <b>Ctrl + S</b> trong lúc luyện nghe để lưu nhé!</p>
       </div>`;
       return;
    }
    
    let html = '';
    snippets.reverse().forEach(s => {
       html += `
         <div class="card" id="vault-card-${s.id}">
           <div class="card-header" style="justify-content:space-between; display:flex;">
             <h3 class="card-title">Test ${s.testId} - Part ${s.partId} | Câu ${s.questionLabel}</h3>
             <i class="ph ph-trash" style="cursor:pointer; color:var(--error); padding:0.5rem; background:#fee2e2; border-radius:4px;" onclick="window.deleteVaultSnippet(${s.id})" title="Xoá"></i>
           </div>
           <div style="background:var(--background); padding:1rem; border-radius:4px; border-left:3px solid var(--primary); margin:1rem 0;">
              <p style="color:var(--text-main); font-weight:500; font-size:1.1rem; line-height:1.6; font-style:italic;">"...${s.textSnippet}..."</p>
           </div>
           <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="window.playVaultSnippet('${s.audioFile}', ${s.startTime}, ${s.endTime})">
             <i class="ph ph-play"></i> Phát lại (3s)
           </button>
         </div>
       `;
    });
    grid.innerHTML = html;
  });
};

let vaultAudio = null;
let vaultTimer = null;
window.playVaultSnippet = (file, start, end) => {
  if (vaultAudio) vaultAudio.pause();
  if (vaultTimer) clearTimeout(vaultTimer);
  
  vaultAudio = new Audio(file);
  vaultAudio.currentTime = start;
  vaultAudio.play().catch(e => alert("Không thể phát audio: " + e.message));
  
  let duration = (end - start) * 1000;
  vaultTimer = setTimeout(() => {
     if(vaultAudio) vaultAudio.pause();
  }, duration);
};

window.deleteVaultSnippet = (id) => {
  if(confirm('Bạn có chắc muốn xoá điểm mù này?')) {
     window.deleteSnippet(id, () => {
        const card = document.getElementById(`vault-card-${id}`);
        if(card) {
           card.style.opacity = '0';
           setTimeout(() => card.remove(), 300);
        }
     });
  }
};

// --- Manual UI ---
window.renderManual = () => {
  if (audioEl) { audioEl.pause(); audioEl = null; }
  if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
  if (typeof vaultAudio !== 'undefined' && vaultAudio) { vaultAudio.pause(); }
  if (typeof vaultTimer !== 'undefined' && vaultTimer) { clearTimeout(vaultTimer); }
  
  const main = document.getElementById('app');
  main.innerHTML = `
    <header class="app-header">
      <div class="logo">
        <i class="ph ph-headphones"></i>
        <h1>TOEIC Master</h1>
      </div>
      <nav class="nav-links">
         <a href="#" onclick="window.renderHome()">Trang chủ</a>
         <a href="grammar.html">Ngữ pháp</a>
         <a href="#" onclick="window.renderVault()">Sniper Vault</a>
         <a href="#" class="active" onclick="window.renderManual()">Hướng dẫn</a>
         <div style="border-left:1px solid rgba(255,255,255,0.3); height:20px; margin:0 0.5rem;"></div>
         <button onclick="window.toggleTheme()" title="Sáng/Tối" style="color:white; font-size:1.1rem; padding:0; display:flex; justify-content:center; align-items:center;"><i class="ph ${window.getThemeIcon()} theme-toggle-icon"></i></button>
      </nav>
    </header>
    <main class="container" style="max-width: 800px;">
      <div class="hero" style="text-align:center; margin-bottom:3rem;">
        <h2 style="font-size:2.5rem; margin-bottom:0.5rem; color:var(--primary);">Cẩm nang Luyện Nghe</h2>
        <p style="font-size:1.1rem; color:var(--text-muted);">Khám phá sức mạnh của hệ thống Hyper-Optimized Listening.</p>
      </div>
      
      <div class="card" style="margin-bottom: 2rem;">
         <h3 style="color:var(--primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-target"></i> 1. Sổ tay Điểm mù (Sniper Vault)</h3>
         <p style="margin-bottom: 1rem; color:var(--text-muted);">Lưu trữ và nghe lại các đoạn audio siêu ngắn gây "lú" lỗ tai.</p>
         <ul style="list-style:disc; margin-left: 2rem; color:var(--text-main); display:flex; flex-direction:column; gap:0.5rem;">
            <li>Trong màn hình Luyện tập (Practice) hoặc Podcast, hãy nhấn phím <b>Ctrl + S</b>.</li>
            <li>Hệ thống sẽ tự động cắt 3 giây đoạn audio hiện tại cùng transcript để lưu vào <b>Sniper Vault</b>.</li>
            <li>Truy cập tab Sniper Vault ở thanh menu trên cùng để nghe lại bất cứ lúc nào. Mọi dữ liệu được lưu offline an toàn.</li>
         </ul>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
         <h3 style="color:var(--primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-link"></i> 2. Phân tích Luyến âm (Connected Speech)</h3>
         <p style="margin-bottom: 1rem; color:var(--text-muted);">Tính năng phát hiện các đoạn nối âm, nuốt chữ đặc trưng của người bản xứ.</p>
         <ul style="list-style:disc; margin-left: 2rem; color:var(--text-main); display:flex; flex-direction:column; gap:0.5rem;">
            <li>Bật biểu tượng cái móc xích (<i class="ph ph-link"></i>) ở thanh công cụ Audio.</li>
            <li>Các chỗ có luyến âm sẽ được tô đỏ và kết nối bằng dấu gạch nối (Ví dụ: <i>turn-it-on</i>).</li>
         </ul>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
         <h3 style="color:var(--primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-eye-slash"></i> 3. Chế độ Ẩn từ & Bắt Keywords</h3>
         <p style="margin-bottom: 1rem; color:var(--text-muted);">Ép não bộ tập trung vào các từ khoá mang nội dung (Content Words) thay vì mạo từ/giới từ.</p>
         <ul style="list-style:disc; margin-left: 2rem; color:var(--text-main); display:flex; flex-direction:column; gap:0.5rem;">
            <li>Chọn chế độ ẩn ở góc trên bên phải màn hình luyện tập.</li>
            <li>Có thể chọn ẩn 1, 3, 5 từ hoặc <b>Bắt Keywords (Mờ)</b>.</li>
            <li>Chế độ Keywords sẽ tự động làm mờ các từ phụ (is, are, in, the...) và bắt bạn điền các từ chính.</li>
         </ul>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
         <h3 style="color:var(--primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-headphones"></i> 4. Podcast Premium Mode</h3>
         <p style="margin-bottom: 1rem; color:var(--text-muted);">Luyện nghe thụ động mượt mà.</p>
         <ul style="list-style:disc; margin-left: 2rem; color:var(--text-main); display:flex; flex-direction:column; gap:0.5rem;">
            <li>Tại Trang chủ, bấm nút <b><i class="ph ph-headphones"></i> P3</b> hoặc <b>P4</b> trên mỗi bài thi.</li>
            <li>Màn hình sẽ chuyển sang chế độ lướt thẻ từ vựng với nhạc nền Lofi siêu chill.</li>
            <li>Bạn có thể chỉnh âm lượng riêng rẽ cho nhạc nền (BGM) và giọng đọc (Voice).</li>
         </ul>
      </div>

      <div class="card" style="margin-bottom: 2rem;">
         <h3 style="color:var(--primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-keyboard"></i> 5. Phím tắt (Hotkeys)</h3>
         <ul style="list-style:disc; margin-left: 2rem; color:var(--text-main); display:flex; flex-direction:column; gap:0.5rem;">
            <li><b>Ctrl + Space:</b> Phát / Tạm dừng audio.</li>
            <li><b>Ctrl + S:</b> Lưu 3 giây điểm mù vào Sniper Vault.</li>
            <li><b>Ctrl + ← / →:</b> Tua nhanh audio lùi/tiến 5 giây.</li>
            <li><b>Alt + ← / →:</b> Nhảy sang câu trước/tiếp theo.</li>
            <li><b>Alt + L:</b> Bật / Tắt chế độ lặp lại câu (Loop).</li>
         </ul>
      </div>
    </main>
  `;
};
