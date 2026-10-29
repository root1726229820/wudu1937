/* ========== 雾都1937 核心交互逻辑 ========== */

// 消除 file:// 离线打开时浏览器自动请求 favicon.ico 产生的报错
(function () {
  if (!document.querySelector('link[rel~="icon"]')) {
    const l = document.createElement('link');
    l.rel = 'icon';
    l.href = 'data:,';
    document.head.appendChild(l);
  }
})();

// ---- 全局状态 ----
const GameState = {
  identity: null,          // 已弃用（改版后不选身份），保留字段仅兼容旧存档
  unlocked: ['dock'],      // 已解锁场景
  completed: [],           // 已完成场景
  collected: [],           // 已收集物品
  endingUnlocked: false,   // 终章是否解锁
  currentChapter: 0,
};

// 场景解锁链（顺序即叙事顺序）
const SCENE_CHAIN = ['dock', 'tunnel', 'newspaper', 'school', 'airport', 'ciqikou'];
const NEXT_SCENE = {
  dock: 'tunnel',
  tunnel: 'newspaper',
  newspaper: 'school',
  school: 'airport',
  airport: 'ciqikou',
  ciqikou: 'ending'
};

// 每一幕固定的亲历者（不再由玩家选择身份：固定谁在哪个场景）
// 码头、大隧道、磁器口由纺织女工林阿婆贯穿，其余各幕对应一位当事人
const SCENE_CHARACTER = {
  dock: 'worker',
  tunnel: 'worker',
  newspaper: 'editor',
  school: 'student',
  airport: 'pilot_family',
  ciqikou: 'worker'
};

// 从 localStorage 读取进度
function loadProgress() {
  try {
    const saved = localStorage.getItem('wudu1937_save');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(GameState, data);
      // 兼容旧存档
      if (!Array.isArray(GameState.unlocked)) GameState.unlocked = ['dock'];
      if (!Array.isArray(GameState.completed)) GameState.completed = [];
      if (!Array.isArray(GameState.collected)) GameState.collected = [];
      if (typeof GameState.endingUnlocked !== 'boolean') GameState.endingUnlocked = false;
      // 旧存档身份名称校正（早期版本误存了角色名）
      if (GameState.identity && GameState.identity.id &&
          typeof IDENTITIES !== 'undefined' && IDENTITIES[GameState.identity.id]) {
        GameState.identity.name = IDENTITIES[GameState.identity.id].name;
        GameState.identity.role = IDENTITIES[GameState.identity.id].role;
      }
    }
  } catch (e) {
    console.log('No save data found.');
  }
}

// 保存进度
function saveProgress() {
  try {
    localStorage.setItem('wudu1937_save', JSON.stringify(GameState));
  } catch (e) {
    console.log('Save failed.');
  }
}

// ---- 雾气转场 ----
function fogTransition(callback) {
  const fog = document.createElement('div');
  fog.className = 'fog-overlay';
  document.body.appendChild(fog);
  requestAnimationFrame(() => {
    fog.classList.add('active');
    setTimeout(() => {
      if (callback) callback();
      setTimeout(() => {
        fog.classList.remove('active');
        setTimeout(() => fog.remove(), 1600);
      }, 500);
    }, 1600);
  });
}

// ---- 打字机效果 ----
function typewriter(el, text, speed = 50) {
  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(tick, speed);
    }
  }
  tick();
}

// ---- 智能路径：根据当前页面深度计算相对路径 ----
function getBasePath() {
  const path = window.location.pathname;
  if (path.includes('/scenes/')) return '../../';   // 二级页面（场景）
  if (path.includes('/pages/')) return '../';      // 一级页面
  return './';                                      // 根目录首页
}

// ---- 开始旅程（首页地图"走进雾都"：不选身份，直接进入第一幕 dock）----
function startJourney() {
  // 清空身份（改版后不选身份），初始化进度为第一幕
  GameState.identity = null;
  GameState.unlocked = ['dock'];
  GameState.completed = [];
  GameState.collected = [];
  GameState.endingUnlocked = false;
  saveProgress();
  Speech.stop();
  const base = getBasePath();
  fogTransition(() => {
    window.location.href = base + 'pages/scenes/dock.html';
  });
}

// 兼容保留：旧版身份选择入口统一改为直接开始旅程
function chooseIdentity() {
  startJourney();
}

// ---- 解锁场景 ----
function unlockScene(sceneId) {
  if (sceneId === 'ending') {
    if (!GameState.endingUnlocked) {
      GameState.endingUnlocked = true;
      saveProgress();
      showToast('✨ 终章已解锁：1945·胜利之夜');
    }
    return;
  }
  if (!GameState.unlocked.includes(sceneId)) {
    GameState.unlocked.push(sceneId);
    saveProgress();
    showToast('✨ 新地点已解锁：' + getSceneName(sceneId));
  }
}

// ---- 完成场景：标记完成并解锁下一幕 ----
function completeScene(sceneId) {
  if (sceneId && !GameState.completed.includes(sceneId)) {
    GameState.completed.push(sceneId);
  }
  const next = NEXT_SCENE[sceneId];
  if (next) unlockScene(next);
  saveProgress();
}

// ---- 收集物品 ----
function collectItem(itemId, itemName) {
  if (!GameState.collected.find(i => i.id === itemId)) {
    GameState.collected.push({ id: itemId, name: itemName, time: new Date().toLocaleString() });
    saveProgress();
    showToast('📁 已收入档案柜：' + itemName);
  }
}

// ---- 提示 Toast ----
function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: var(--ink); color: var(--paper); padding: 12px 28px;
    font-size: 14px; letter-spacing: 0.1em; z-index: 9999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); opacity: 0;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ---- 场景名称映射 ----
function getSceneName(id) {
  const map = {
    dock: '朝天门码头',
    tunnel: '较场口大隧道',
    newspaper: '新华日报社',
    school: '沙坪坝学校',
    airport: '广阳坝机场',
    ciqikou: '磁器口古镇',
    ending: '终章·胜利之夜'
  };
  return map[id] || id;
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  initAudio();
  Speech.init();
});

// ---- 音效系统（Web Audio API 生成，无需外部文件）----
let audioCtx = null;
function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { console.log('Audio not supported'); }
}
function ensureAudio() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
  if (!audioCtx) return;
  // 浏览器自动播放策略：首次交互后需手动恢复 AudioContext
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);

  switch(type) {
    case 'click':
      o.frequency.value = 800;
      g.gain.setValueAtTime(0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      o.start(); o.stop(audioCtx.currentTime + 0.08);
      break;
    case 'type':
      o.frequency.value = 1200 + Math.random() * 400;
      g.gain.setValueAtTime(0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
      o.start(); o.stop(audioCtx.currentTime + 0.03);
      break;
    case 'alarm':
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(400, audioCtx.currentTime);
      o.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
      o.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 1);
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      o.start(); o.stop(audioCtx.currentTime + 1);
      break;
    case 'collect':
      o.frequency.setValueAtTime(600, audioCtx.currentTime);
      o.frequency.setValueAtTime(900, audioCtx.currentTime + 0.1);
      o.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
      g.gain.setValueAtTime(0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      o.start(); o.stop(audioCtx.currentTime + 0.3);
      break;
    case 'boom':
      // 远处爆炸：低频噪声轰鸣
      try {
        const dur = 1.6;
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 220;
        const gg = audioCtx.createGain();
        gg.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gg.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
        src.connect(lp); lp.connect(gg); gg.connect(audioCtx.destination);
        src.start();
      } catch(e) {}
      break;
  }
}

/* ========== 环境音系统（Web Audio 实时合成，低音量循环） ========== */
let ambientNodes = null;
let ambientType = null;

function makeNoiseBuffer(seconds) {
  const len = audioCtx.sampleRate * seconds;
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startAmbient(type) {
  ensureAudio();
  stopAmbient();
  if (!audioCtx) return;
  ambientType = type;
  const ctx = audioCtx;
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.5);
  ambientNodes = { master, timers: [] };

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(3);
  noise.loop = true;

  switch(type) {
    case 'wind': { // 江风：带通噪声 + 起伏
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0.06;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12; lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      noise.connect(bp); bp.connect(g); g.connect(master);
      noise.start(); lfo.start();
      Object.assign(ambientNodes, { stopList: [noise, lfo] });
      // 偶尔一声船笛
      ambientNodes.timers.push(setInterval(() => {
        if (ambientType !== type) return;
        const o = ctx.createOscillator(), gg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(180, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(140, ctx.currentTime + 1.6);
        gg.gain.setValueAtTime(0, ctx.currentTime);
        gg.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.3);
        gg.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
        o.connect(gg); gg.connect(master);
        o.start(); o.stop(ctx.currentTime + 2);
      }, 15000));
      break;
    }
    case 'rumble': { // 隧道：低频闷响 + 远处警报
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 90;
      const g = ctx.createGain(); g.gain.value = 0.12;
      noise.connect(lp); lp.connect(g); g.connect(master);
      noise.start();
      // 周期性闷爆
      ambientNodes.timers.push(setInterval(() => {
        if (ambientType !== type) return;
        playSound('boom');
      }, 7000));
      // 远处警报（轻柔）
      const alarm = ctx.createOscillator();
      const ag = ctx.createGain();
      alarm.type = 'sawtooth';
      alarm.frequency.value = 420;
      ag.gain.value = 0.018;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.4; lfoG.gain.value = 120;
      lfo.connect(lfoG); lfoG.connect(alarm.frequency);
      alarm.connect(ag); ag.connect(master);
      alarm.start(); lfo.start();
      Object.assign(ambientNodes, { stopList: [noise, alarm, lfo] });
      break;
    }
    case 'print': { // 印刷机：节奏咔哒
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = 0.05;
      noise.connect(lp); lp.connect(g); g.connect(master);
      noise.start();
      ambientNodes.timers.push(setInterval(() => {
        if (ambientType !== type) return;
        const o = ctx.createOscillator(), gg = ctx.createGain();
        o.type = 'square'; o.frequency.value = 140;
        gg.gain.setValueAtTime(0.05, ctx.currentTime);
        gg.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);
        o.connect(gg); gg.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.1);
      }, 620));
      Object.assign(ambientNodes, { stopList: [noise] });
      break;
    }
    case 'rain': { // 雨声：高通噪声
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1100;
      const g = ctx.createGain(); g.gain.value = 0.09;
      noise.connect(hp); hp.connect(g); g.connect(master);
      noise.start();
      Object.assign(ambientNodes, { stopList: [noise] });
      break;
    }
    case 'plane': { // 机场：风声 + 周期性飞机掠过
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 400;
      const g = ctx.createGain(); g.gain.value = 0.05;
      noise.connect(lp); lp.connect(g); g.connect(master);
      noise.start();
      ambientNodes.timers.push(setInterval(() => {
        if (ambientType !== type) return;
        const o = ctx.createOscillator(), gg = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(90, ctx.currentTime + 3.2);
        gg.gain.setValueAtTime(0, ctx.currentTime);
        gg.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 1.2);
        gg.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.4);
        o.connect(gg); gg.connect(master);
        o.start(); o.stop(ctx.currentTime + 3.5);
      }, 11000));
      Object.assign(ambientNodes, { stopList: [noise] });
      break;
    }
    case 'crowd': { // 茶馆：低频人声嗡鸣
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      const g = ctx.createGain(); g.gain.value = 0.08;
      noise.connect(lp); lp.connect(g); g.connect(master);
      noise.start();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.25; lfoG.gain.value = 0.03;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      lfo.start();
      Object.assign(ambientNodes, { stopList: [noise, lfo] });
      break;
    }
    default:
      noise.stop();
  }
}

function stopAmbient() {
  if (!ambientNodes) return;
  const { master, timers, stopList } = ambientNodes;
  timers.forEach(t => clearInterval(t));
  try {
    master.gain.cancelScheduledValues(audioCtx.currentTime);
    master.gain.setValueAtTime(master.gain.value, audioCtx.currentTime);
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
    setTimeout(() => { try { master.disconnect(); } catch(e) {} }, 800);
  } catch(e) {}
  if (stopList) stopList.forEach(n => { try { n.stop(); } catch(e) {} });
  ambientNodes = null;
  ambientType = null;
}

function toggleAmbient(btn, type) {
  ensureAudio();
  if (ambientType) {
    stopAmbient();
    if (btn) { btn.textContent = '🔈 开启环境音'; btn.classList.remove('on'); }
  } else {
    startAmbient(type);
    if (btn) { btn.textContent = '🔊 关闭环境音'; btn.classList.add('on'); }
  }
}

// 页面卸载时停止环境音、语音，并关闭外壳对话框
window.addEventListener('pagehide', () => {
  stopAmbient();
  Speech.stop();
  try { window.parent.postMessage({ __wudu1937: 'dialogue', action: 'close' }, '*'); } catch (e) {}
});

/* ========== 语音朗读系统（Web Speech API，离线中文朗读） ========== */
const Speech = {
  enabled: true,
  voice: null,
  init() {
    if (!('speechSynthesis' in window)) { this.enabled = false; return; }
    try {
      this.enabled = localStorage.getItem('wudu1937_voice') !== '0';
    } catch(e) {}
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      this.voice =
        voices.find(v => v.lang === 'zh-CN' && /female|hui|xiaoxiao|yaoyao/i.test(v.name)) ||
        voices.find(v => v.lang === 'zh-CN') ||
        voices.find(v => v.lang && v.lang.toLowerCase().indexOf('zh') === 0) ||
        null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  },
  speak(text, opts) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (this.voice) u.voice = this.voice;
    u.pitch = (opts && opts.pitch) || 1;
    u.rate = (opts && opts.rate) || 0.92;
    u.volume = 0.95;
    synth.speak(u);
  },
  stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  },
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('wudu1937_voice', this.enabled ? '1' : '0'); } catch(e) {}
    if (!this.enabled) this.stop();
    return this.enabled;
  }
};

/* ========== 身份档案 ========== */
const IDENTITIES = {
  worker: {
    name: '林阿婆', role: '纺织女工',
    img: 'char-worker.jpg',
    voice: { pitch: 1.15, rate: 0.9 }
  },
  student: {
    name: '苏同学', role: '流亡学生',
    img: 'char-student.jpg',
    voice: { pitch: 1.05, rate: 1.0 }
  },
  editor: {
    name: '陈先生', role: '报馆校对',
    img: 'char-editor.jpg',
    voice: { pitch: 0.85, rate: 0.92 }
  },
  pilot_family: {
    name: '周太太', role: '空军家属',
    img: 'char-pilot.jpg',
    voice: { pitch: 1.1, rate: 0.9 }
  }
};

// 每个身份在每个场景的内心独白（身份差异化的核心）
const IDENTITY_MONOLOGUES = {
  worker: {
    dock: ['我是跟着申新纱厂的机器一路上来的。', '三十二箱设备，我押运了三箱——船过三峡时，我把铺盖盖在机器上，怕雨淋。'],
    tunnel: ['纱锭刚停，警报就响了。', '工头喊“跑”，我们几十号女工手拉着手往较场口跑，鞋都跑掉了。'],
    newspaper: ['我不识字，可我认得报纸上的黑框——那是死人的名字。', '一张报纸，全车间的女工传着看，看完了谁都不说话。'],
    school: ['我没念过书，名字还是夜校先生教我写的。', '路过这些茅草教室总多看两眼——我们这代人纺的纱，是为了他们能坐着念书。'],
    airport: ['机场的人说，我们纱厂纺的布，做了降落伞。', '一想到天上的人背着我纺的布，这纺车我就不敢停。'],
    ciqikou: ['今天不开工，我来磁器口喝碗茶。', '茶是苦的，可雾一起，我忽然觉得，能活着看见这条江，就是好的。']
  },
  student: {
    dock: ['我从武汉溯江而上，船走了二十一天。', '行李什么都没带，就带了一本《物理》，封皮掉了，用报纸重新糊过。'],
    tunnel: ['警报响的时候，我正在操场背单词。', '我跟着人流跑，手里还攥着那本书——命都快没了，还攥着书，可笑吧。'],
    newspaper: ['《新华日报》我每期都读，还投过稿，用的笔名。', '昨晚的事，我想写下来，可笔提起来，手抖得一个字都写不成。'],
    school: ['这是我们的学校。茅草顶，黄泥墙，可它是大后方最亮的灯。', '老师说，敌人炸得了校舍，炸不了课本里的公式。'],
    airport: ['我们班三个男生去考了空军，年纪最小的才十七。', '他们说天上的事总得有人做；我留在地上把书念完，也是做事。'],
    ciqikou: ['今天我们在茶馆门口演街头剧，我演那个报信的学生。', '围观的老太太从头哭到尾，散场了还往我手里塞了个橘子。']
  },
  editor: {
    dock: ['报馆的铅字和印刷机，比我人金贵，我是押着它们上的船。', '船过夔门，浪打上来，我用身子挡住机器，自己的铺盖全湿了。'],
    tunnel: ['我是来记的。校对的人有个毛病，看见什么都想在心里排成铅字。', '可今晚的事，我怕我排不出来——有些字，铅水铸不动。'],
    newspaper: ['这是我的车间。', '昨晚的号外，我校了七遍，一个标点都不许错——为他们说话的字，更不能错。'],
    school: ['方先生是我旧识，我来向学生们约稿。', '年轻人的文章火气旺，我一字不改——这个世道，就该有火气。'],
    airport: ['我来机场采访，机械兵小沈说，他每天数飞机，少一架就躲起来哭一次。', '我把这句话记在小本子上，想着总有一天，要让它见报。'],
    ciqikou: ['陈老板的茶馆，是这城里还能说真话的地方。', '我来听，也来记。胜利的消息要是有一天来，我想我会在这里听到。']
  },
  pilot_family: {
    dock: ['我是随家眷船上来的，丈夫在前面搬物资，我在船上守着行李。', '江上的风大，我把他的一件毛衣抱在怀里，像抱着他的人。'],
    tunnel: ['警报响的时候，我正在纳鞋底。', '我没跑——我往机场的方向望，他说今天有任务。后来是防护团的人把我架进洞的。'],
    newspaper: ['报纸上每一个击落数字，我都要读三遍。', '我怕读到那个部队的番号，又怕读不到——读不到，说明他们还在天上。'],
    school: ['我来给孩子们送两件旧衣裳。', '丈夫说，等胜利了，我们的孩子也要进这样的学堂。'],
    airport: ['我每天都来坝子边，数飞机，一架，两架，三架。', '他那架的编号我认得——别人看飞机都一样，我看每一架都不一样。'],
    ciqikou: ['他的飞机，上个月没回来。', '我来磁器口点一盏灯，掌柜说灯不用我出钱。我想，天那么黑，他兴许顺着光，能找回家。']
  }
};

// 各场景身份专属结局独白
const IDENTITY_ENDINGS = {
  worker: ['胜利那天，我在纱厂。', '汽笛响了，没人喊开工，姐妹们抱在一起哭，哭完了，又把断了的纱接上。', '后来我留在了重庆。这座城的码头，我卸过机器；这座城的洞子，我躲过炸弹；这座城的每一根纱，都有我的手温。', '——林阿婆，江苏无锡人，战时南岸某纱厂女工。'],
  student: ['胜利那天，我在学校。', '操场上有人喊“日本投降了”，整个沙坪坝的书都扔上了天。', '我把那本掉了封皮的《物理》留在了学校，留给下一届的学生。', '——苏同学，武汉人，战时沙坪坝流亡学生。战后考入大学，学了航空工程。'],
  editor: ['胜利那天，我在报馆。', '号外的标题是社长亲自写的，我校了一遍，又一遍。', '我把妻子哥哥的名字从阵亡版里取出来，放进一个新匣子——以后，他只是我们家的人，不再是一个铅字。', '——陈先生，浙江人，战时《新华日报》校对。'],
  pilot_family: ['胜利那天，我在磁器口。', '江上的灯一盏一盏亮起来，我数着，数到第一百盏，就当是他回来了。', '后来我没有改嫁，在广阳坝附近的小学教书，教孩子们认的第一个词，是“回家”。', '——周太太，成都人，战时空军地勤家属。']
};

/* ========== NPC 对话 ========== */
const NPC_DIALOGUES = {
  dock: {
    name: '老王 · 码头搬运工', img: '👷',
    voice: { pitch: 0.72, rate: 0.9 },
    lines: [
      '1938年的春天，朝天门的船，比往年多了十倍。',
      '从下游上来的——工厂、学校、难民、机器，全往重庆涌。',
      '我们这些扛码头的，脚不沾地地搬。一箱一箱，从船上卸到岸上，再扛到山坡上。',
      '有人问我搬的是啥，我说不晓得，反正是国家的东西，丢不得。',
      '你也是从下游来的？这条命既然到了重庆，就得活下去——还得让国家活下去。'
    ]
  },
  tunnel: {
    name: '老周 · 防空防护团', img: '🪖',
    voice: { pitch: 0.8, rate: 0.95 },
    lines: [
      '我是防护团的，警报一响，我们得在街上催人进洞。',
      '今天这警报邪性，三批飞机轮着来，半点不给人喘气的工夫。',
      '洞里人越来越多……你莫往深处挤，听我一句，守着洞口些。',
      '（远处传来闷响，洞壁的土簌簌往下掉）稳住！都稳住！把孩子举高些！',
      '记住今天——不管你最后走不走得出去，都得有人记住今天。'
    ]
  },
  newspaper: {
    name: '老赵 · 印刷工', img: '📰',
    voice: { pitch: 0.85, rate: 1.0 },
    lines: [
      '昨晚隧道里出的事，天没亮我们就知道了。',
      '这台机器转了一整夜，铅字排了拆、拆了排。',
      '有些话，新闻检查不让写，我们就留白——整块整块的留白，重庆人看得懂。',
      '你看这报纸，油墨还没干。它一出去，就是几十万人心里的一口气。',
      '报在，人心就在。拿走一份，替我们传出去。'
    ]
  },
  school: {
    name: '方先生 · 流亡教师', img: '👨‍🏫',
    voice: { pitch: 0.9, rate: 0.93 },
    lines: [
      '教室是竹篱笆糊黄泥，屋顶盖茅草，一下雨，满屋都是水。',
      '可你看这些学生，炸弹都炸不散他们，天没亮就来占座。',
      '我教他们念书，也教他们记住：读书不是为了考大学，是为了这个国家还有将来。',
      '晚上他们提了油灯去贴标语、演街头剧，拦都拦不住。',
      '中国的将来不在战场上，在这些孩子的课本里。'
    ]
  },
  airport: {
    name: '小沈 · 地勤机械兵', img: '🧑‍🔧',
    voice: { pitch: 0.9, rate: 1.06 },
    lines: [
      '我是地勤，飞机上天前最后一道关，就是我手里的扳手。',
      '看见天上那些飞机没？驼峰航线，从印度翻着雪山过来的，运的是汽油、药品、枪炮。',
      '那座雪山，山谷里全是坠机的铝皮，亮闪闪的，我们叫它“铝谷”。',
      '每天飞机回来，我都数。少一架，就有一户人家的天，塌了。',
      '你要是看见飞机起飞，就挥挥手——他们在天上，看得见。'
    ]
  },
  ciqikou: {
    name: '陈老板 · 茶馆掌柜', img: '🧓',
    voice: { pitch: 0.7, rate: 0.88 },
    lines: [
      '城里炸得凶，有钱人、没钱人，都往我这磁器口跑。',
      '茶馆白天卖茶，晚上就是难民所。铺盖我借出去三床，账上就写“不计”。',
      '码头工人、学生、报馆先生、飞行员的太太，到了我这儿，都是一碗茶。',
      '你看这江上的雾，散了又聚，聚了又散——重庆人也是这样，炸不散的。',
      '等打完了仗，你再来，我还给你泡一壶，不收钱。'
    ]
  }
};

/* ========== 视觉小说对话系统（对话框常驻外壳 app.html，内容页通过 postMessage 驱动） ========== */
function showDialogue(characterName, characterImg, lines, onComplete, options) {
  options = options || {};
  // 头像：图片统一只传文件名（外壳拼 assets/images/）；emoji 原样传递
  let img = characterImg;
  if (img && /\.(jpg|jpeg|png|webp)/i.test(img)) {
    img = img.replace(/^.*[\\/]/, '');
  }
  const payload = {
    __wudu1937: 'dialogue',
    name: characterName,
    img: img,
    lines: lines,
    voice: options.voice || null,
    mono: !!options.mono,
    tag: options.tag || ''
  };

  // 外壳播完这一段后回 dialogueDone，再进入下一段
  const handler = (e) => {
    if (e.data && e.data.__wudu1937 === 'dialogueDone') {
      window.removeEventListener('message', handler);
      if (onComplete) onComplete();
    }
  };
  window.addEventListener('message', handler);
  try { window.parent.postMessage(payload, '*'); } catch (e) {}
}

// 关闭外壳对话框（切页时由外壳自动处理，这里保留手动入口）
function closeDialogue() {
  try { window.parent.postMessage({ __wudu1937: 'dialogue', action: 'close' }, '*'); } catch (e) {}
}

// ---- 场景统一入口：身份独白 → NPC 对话 → 环境音 ----
function startScene(sceneId) {
  ensureAudio();
  const base = getBasePath();
  const segments = [];

  // 第一段：这一幕固定亲历者的内心独白
  const id = SCENE_CHARACTER[sceneId];
  const identity = id ? IDENTITIES[id] : null;
  const mono = (id && IDENTITY_MONOLOGUES[id] && IDENTITY_MONOLOGUES[id][sceneId]) || null;
  if (identity && mono) {
    segments.push({
      name: identity.name + ' · 这一幕',
      img: identity.img,
      lines: mono,
      voice: identity.voice,
      mono: true,
      tag: identity.name + '的视角'
    });
  }

  // 第二段：场景 NPC
  const npc = NPC_DIALOGUES[sceneId];
  if (npc) {
    segments.push({
      name: npc.name, img: npc.img, lines: npc.lines, voice: npc.voice
    });
  }

  let idx = 0;
  function next() {
    if (idx >= segments.length) return;
    const s = segments[idx++];
    showDialogue(s.name, s.img, s.lines, next, {
      voice: s.voice, mono: s.mono, tag: s.tag
    });
  }
  next();
}

/* ========== 场景动态特效（雾气 / 粒子 / 飞机 / 雨 / 灯） ========== */
function mountSceneFX(headerEl, type) {
  if (!headerEl) return;
  // 雾气层（所有场景通用）
  for (let i = 0; i < 3; i++) {
    const fog = document.createElement('div');
    fog.className = 'scene-fog f' + i;
    headerEl.appendChild(fog);
  }
  // 颗粒层
  const grain = document.createElement('div');
  grain.className = 'scene-grain';
  headerEl.appendChild(grain);

  if (type === 'dock') {
    // 江面波纹光带
    for (let i = 0; i < 3; i++) {
      const wave = document.createElement('div');
      wave.className = 'fx-wave';
      wave.style.animationDelay = (i * 2.5) + 's';
      wave.style.bottom = (8 + i * 6) + '%';
      headerEl.appendChild(wave);
    }
  }
  if (type === 'tunnel') {
    // 飘落灰尘 + 警报红光
    headerEl.classList.add('fx-raid');
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'fx-dust';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = (Math.random() * 6) + 's';
      p.style.animationDuration = (5 + Math.random() * 5) + 's';
      headerEl.appendChild(p);
    }
  }
  if (type === 'newspaper') {
    // 飘落纸絮
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'fx-paper';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.animationDuration = (9 + Math.random() * 7) + 's';
      headerEl.appendChild(p);
    }
  }
  if (type === 'school') {
    // 雨丝
    for (let i = 0; i < 40; i++) {
      const r = document.createElement('div');
      r.className = 'fx-rain';
      r.style.left = Math.random() * 100 + '%';
      r.style.animationDelay = (Math.random() * 1.5) + 's';
      r.style.animationDuration = (0.7 + Math.random() * 0.6) + 's';
      headerEl.appendChild(r);
    }
  }
  if (type === 'airport') {
    // 掠过的飞机剪影 + 流云
    for (let i = 0; i < 2; i++) {
      const plane = document.createElement('div');
      plane.className = 'fx-plane';
      plane.textContent = '✈';
      plane.style.top = (18 + i * 22) + '%';
      plane.style.animationDelay = (i * 9) + 's';
      plane.style.animationDuration = '18s';
      headerEl.appendChild(plane);
    }
    for (let i = 0; i < 3; i++) {
      const c = document.createElement('div');
      c.className = 'fx-cloud';
      c.style.top = (10 + i * 20) + '%';
      c.style.animationDelay = (i * 7) + 's';
      c.style.animationDuration = (40 + i * 15) + 's';
      headerEl.appendChild(c);
    }
  }
  if (type === 'ciqikou') {
    // 灯笼光晕 + 炊烟
    for (let i = 0; i < 5; i++) {
      const l = document.createElement('div');
      l.className = 'fx-lantern';
      l.style.left = (12 + i * 19) + '%';
      l.style.animationDelay = (Math.random() * 3) + 's';
      headerEl.appendChild(l);
    }
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('div');
      s.className = 'fx-smoke';
      s.style.left = (20 + i * 30) + '%';
      s.style.animationDelay = (i * 4) + 's';
      headerEl.appendChild(s);
    }
  }
  if (type === 'ending') {
    // 胜利之夜：上升的灯火
    for (let i = 0; i < 30; i++) {
      const l = document.createElement('div');
      l.className = 'fx-spark';
      l.style.left = Math.random() * 100 + '%';
      l.style.animationDelay = (Math.random() * 8) + 's';
      l.style.animationDuration = (6 + Math.random() * 6) + 's';
      headerEl.appendChild(l);
    }
  }
}

// ---- 终章：群像结局（四位当事人胜利那天，最后铭记总结）----
function playEnding() {
  ensureAudio();
  const segments = [];
  // 依次呈现四位固定当事人的结局
  const order = ['worker', 'student', 'editor', 'pilot_family'];
  order.forEach(function (id) {
    const identity = IDENTITIES[id];
    const lines = IDENTITY_ENDINGS[id];
    if (identity && lines) {
      segments.push({
        name: identity.name,
        img: identity.img,
        lines: lines,
        voice: identity.voice,
        mono: true,
        tag: identity.name + '的结局'
      });
    }
  });
  // 最后铭记总结
  segments.push({
    name: '雾都记忆',
    img: '🕯️',
    lines: [
      '你走过的每一条街、躲过的每一个洞、拾得的每一件东西，都成了这座城活下去的证据。',
      '1941年6月5日，重庆“六五”大隧道惨案，约2500名同胞遇难。',
      '这座城至今记得——历史不是课本上的年份，而是普通人在最黑暗时刻的选择。',
      '谨以此，献给每一个在最黑的夜里没有放弃的普通人。'
    ],
    mono: true,
    tag: '铭记'
  });

  let idx = 0;
  function next() {
    if (idx >= segments.length) return;
    const s = segments[idx++];
    showDialogue(s.name, s.img, s.lines, next, {
      voice: s.voice, mono: s.mono, tag: s.tag
    });
  }
  next();
}

// ---- 完成本场景并前往下一幕（统一的解锁+雾转场） ----
function goToNext(currentId, url) {
  completeScene(currentId);
  playSound('collect');
  const next = NEXT_SCENE[currentId];
  // 在外壳内：交由外壳播放"小人在地图上走往下一点"的过场，再由外壳跳转
  if (next && window.parent !== window.self) {
    try {
      window.parent.postMessage({ __wudu1937: 'walk', from: currentId, to: next }, '*');
      return;
    } catch (e) { /* 落入兜底 */ }
  }
  // 直接打开（非外壳）时的兜底
  showToast('雾散了，新的地点在地图上亮起');
  setTimeout(() => {
    fogTransition(() => { window.location.href = url; });
  }, 700);
}

// ---- 导航：回到主页 ----
function goHome() {
  const base = getBasePath();
  fogTransition(() => {
    window.location.href = base + 'index.html';
  });
}

// ---- 导航：重新开始（清空进度，回到首页地图）----
function restartJourney() {
  if (confirm('确定要重新开始吗？当前探索进度将被清空。')) {
    localStorage.removeItem('wudu1937_save');
    const base = getBasePath();
    fogTransition(() => {
      window.location.href = base + 'index.html';
    });
  }
}
// 兼容保留旧名（旧外壳/页面可能引用）
function reselectIdentity() {
  restartJourney();
}

// ---- 浮动导航已常驻外壳 app.html（#float-nav），内容页不再重复创建 ----
