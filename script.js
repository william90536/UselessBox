/**
 * 全域核心參數配置
 */
const CONFIG = {
  SWITCH_XS: [98, 199, 300, 401, 502],
  SWITCH_Y: 315,
  LID_INITIAL_HEIGHT: 72,
  OCTOPUS_IDLE_X: 300,
  OCTOPUS_IDLE_Y: 240,
  OCTOPUS_PEEK_Y: 180,
  IDLE_TIMEOUT_MS: 10000,
  LERP: {
    NORMAL: 0.16,
    ANGRY: 0.32,
    LID: 0.22,
    TENTACLE: 0.26
  }
};

/**
 * 音效合成引擎
 */
const AudioEngine = {
  isMuted: true,
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  playClick() {
    if (this.isMuted) return; this.init();
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.start(); osc.stop(this.ctx.currentTime + 0.05);
  },
  playWood() {
    if (this.isMuted) return; this.init();
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(130, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.start(); osc.stop(this.ctx.currentTime + 0.12);
  },
  playSqueak(isAngry = false) {
    if (this.isMuted) return; this.init();
    const now = this.ctx.currentTime, dur = isAngry ? 0.09 : 0.2, loops = isAngry ? 3 : 1;
    for (let i = 0; i < loops; i++) {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAngry ? 850 + i * 160 : 550, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(isAngry ? 1700 : 1050, now + i * 0.04 + dur);
      gain.gain.setValueAtTime(0.08, now + i * 0.04); gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + dur);
      osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + dur);
    }
  }
};

/**
 * jQuery DOM 元素統一管理器
 */
let Dom = {};

/**
 * 全域應用程式狀態模型
 */
const AppStore = {
  switchesState: [false, false, false, false, false],
  isBusy: false,
  idleTimer: null,
  hasAnyActiveSwitch() {
    return this.switchesState.some(state => state);
  },
  getActiveIndices() {
    const indices = [];
    this.switchesState.forEach((state, i) => { if (state) indices.push(i); });
    return indices;
  }
};

/**
 * 章魚物理運算與視覺渲染引擎 (jQuery 驅動版)
 */
const OctopusEngine = {
  targetX: CONFIG.OCTOPUS_IDLE_X,
  targetY: CONFIG.OCTOPUS_IDLE_Y,
  targetLidProgress: 0,
  targetTentacleProgress: [0, 0, 0, 0, 0],

  currentX: CONFIG.OCTOPUS_IDLE_X,
  currentY: CONFIG.OCTOPUS_IDLE_Y,
  currentLidProgress: 0,
  currentTentacleProgress: [0, 0, 0, 0, 0],

  mood: 'idle',
  expression: 'normal',

  $tentacles: [],
  $suckers: [],

  init() {
    for (let i = 0; i < 5; i++) {
      this.$tentacles.push($(`#tentacle-${i}`));
      this.$suckers.push($(`#suckers-${i}`));
    }
    this.startPhysicsLoop();
  },

  setMood(newMood, newExpression) {
    this.mood = newMood;
    this.expression = newExpression;
    this.renderExpressions();
  },

  renderExpressions() {
    Dom.$octopusHead.attr('fill', this.mood === 'angry' ? '#ef4444' : '#8b5cf6');

    switch (this.expression) {
      case 'shocked':
        Dom.$leftEyeWhite.attr({ rx: 15, ry: 15 });
        Dom.$rightEyeWhite.attr({ rx: 15, ry: 15 });
        Dom.$leftPupil.attr({ r: 4, fill: '#1e1b4b' });
        Dom.$rightPupil.attr({ r: 4, fill: '#1e1b4b' });
        Dom.$mouthPath.attr('d', 'M -5 14 A 4 4 0 1 1 5 14');
        Dom.$eyebrowLeft.addClass('hidden');
        Dom.$eyebrowRight.addClass('hidden');
        break;
      case 'angry':
        Dom.$leftEyeWhite.attr({ rx: 13, ry: 13 });
        Dom.$rightEyeWhite.attr({ rx: 13, ry: 13 });
        Dom.$leftPupil.attr({ r: 5.5, fill: '#ff1111' });
        Dom.$rightPupil.attr({ r: 5.5, fill: '#ff1111' });
        Dom.$mouthPath.attr('d', 'M -6 16 Q 0 10 6 16');
        Dom.$eyebrowLeft.removeClass('hidden');
        Dom.$eyebrowRight.removeClass('hidden');
        break;
      default:
        Dom.$leftEyeWhite.attr({ rx: 13, ry: 13 });
        Dom.$rightEyeWhite.attr({ rx: 13, ry: 13 });
        Dom.$leftPupil.attr({ r: 7, fill: '#1e1b4b' });
        Dom.$rightPupil.attr({ r: 7, fill: '#1e1b4b' });
        Dom.$mouthPath.attr('d', 'M -6 12 Q 0 17 6 12');
        Dom.$eyebrowLeft.addClass('hidden');
        Dom.$eyebrowRight.addClass('hidden');
        break;
    }

    if (this.mood !== 'curious') {
      Dom.$leftPupil.attr('cx', '-20');
      Dom.$rightPupil.attr('cx', '20');
    }
  },

  calculateTentaclePath(idx) {
    const anchorOffsets = [-35, -17, 0, 17, 35];
    const startX = this.currentX + anchorOffsets[idx];
    const startY = this.currentY + 25;
    const progress = this.currentTentacleProgress[idx];

    const targetX = CONFIG.SWITCH_XS[idx];
    const targetY = CONFIG.SWITCH_Y;

    const currentTipX = startX + (targetX - startX) * progress;
    const currentTipY = startY + (targetY - startY) * progress;

    const controlX = (startX + currentTipX) / 2 + (idx - 2) * 12;
    const controlY = Math.min(startY, currentTipY) - (60 * progress);

    return `M ${startX} ${startY} Q ${controlX} ${controlY} ${currentTipX} ${currentTipY}`;
  },

  startPhysicsLoop() {
    const loop = () => {
      const bodyLerp = (this.mood === 'angry') ? CONFIG.LERP.ANGRY : CONFIG.LERP.NORMAL;
      this.currentX += (this.targetX - this.currentX) * bodyLerp;
      this.currentY += (this.targetY - this.currentY) * bodyLerp;

      this.currentLidProgress += (this.targetLidProgress - this.currentLidProgress) * CONFIG.LERP.LID;
      const newLidHeight = CONFIG.LID_INITIAL_HEIGHT * (1 - this.currentLidProgress * 0.9);

      Dom.$boxLid.attr('height', Math.max(2, newLidHeight));
      Dom.$lidHandle.attr('y', 140 + newLidHeight - 8);

      for (let i = 0; i < 5; i++) {
        this.currentTentacleProgress[i] += (this.targetTentacleProgress[i] - this.currentTentacleProgress[i]) * CONFIG.LERP.TENTACLE;
      }

      let scaleX = 1, scaleY = 1, rotation = 0, shakeX = 0, shakeY = 0;
      if (this.mood === 'attacking') {
        scaleX = 1.15; scaleY = 0.85;
      } else if (this.mood === 'angry') {
        scaleX = 1.05; scaleY = 0.95;
        shakeX = (Math.random() - 0.5) * 5;
        shakeY = (Math.random() - 0.5) * 5;
        rotation = (Math.random() - 0.5) * 6;
      }
      Dom.$octopusGroup.css({
        'transform-origin': '0px 100px',
        'transform': `translate(${this.currentX + shakeX}px, ${this.currentY + shakeY}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`
      });

      for (let i = 0; i < 5; i++) {
        if (this.currentTentacleProgress[i] < 0.01) {
          this.$tentacles[i].attr('d', '');
          this.$suckers[i].attr('d', '');
        } else {
          const pathData = this.calculateTentaclePath(i);
          this.$tentacles[i].attr('d', pathData);
          this.$suckers[i].attr('d', pathData);
        }
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
};

/**
 * 異步行為決策大腦
 */
const SequenceBrain = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  async processNextAction() {
    if (AppStore.isBusy) return;
    AppStore.isBusy = true;
    this.clearIdleTimer();

    while (AppStore.hasAnyActiveSwitch()) {
      const activeIndices = AppStore.getActiveIndices();
      const count = activeIndices.length;

      if (count >= 3) {
        await this.executeWiperSweep(activeIndices);
      } else if (count === 2) {
        await this.executeMultiAttack(activeIndices);
      } else if (count === 1) {
        const targetIdx = activeIndices[0];
        if (Math.random() < 0.35) {
          await this.executeFakeoutAttack(targetIdx);
        } else {
          await this.executeSingleAttack(targetIdx);
        }
      }
    }

    this.returnToStandby();
  },
  
  async tentacleMovement(idx, progress, awaitTime){
    OctopusEngine.targetTentacleProgress[idx] = progress;
    await this.sleep(awaitTime);
  },

  async executeSingleAttack(targetIdx) {
    Dom.$terminalText.text(`鎖定目標開關 SW-${targetIdx + 1}，平移就位... 🎯`);
    OctopusEngine.setMood('moving', 'shocked');

    OctopusEngine.targetX = CONFIG.SWITCH_XS[targetIdx];
    OctopusEngine.targetY = CONFIG.OCTOPUS_PEEK_Y;
    OctopusEngine.targetLidProgress = 1.0;
    AudioEngine.playWood();

    await this.sleep(350);

    if (!AppStore.switchesState[targetIdx]) {
      await this.retractTentacle(targetIdx);
      return;
    }

    Dom.$terminalText.text(`看招！啪！💥`);
    OctopusEngine.setMood('attacking', 'angry');
    AudioEngine.playSqueak(false);

    OctopusEngine.targetTentacleProgress[targetIdx] = 1.0;

    if (AppStore.switchesState[targetIdx]) {
      AppStore.switchesState[targetIdx] = false;
      UIController.updateSwitchesHardwareUI();
      AudioEngine.playClick();
    }

    await this.sleep(500);
    await this.retractTentacle(targetIdx);
  },

  async executeFakeoutAttack(targetIdx) {
    Dom.$terminalText.text(`對決 SW-${targetIdx + 1}... 等等，裝死故障中... 🔌`);
    OctopusEngine.setMood('moving', 'normal');

    OctopusEngine.targetX = CONFIG.SWITCH_XS[targetIdx];
    OctopusEngine.targetY = 185;
    OctopusEngine.targetLidProgress = 0.65;
    AudioEngine.playWood();
    await this.sleep(250);

    if (!AppStore.switchesState[targetIdx]) { await this.retractTentacle(targetIdx); return; }
    
    for(let i = 0; i < 2; i++){
      await this.tentacleMovement(targetIdx, 0.55, 300);
      await this.tentacleMovement(targetIdx, 0, 300);
    }
    Dom.$terminalText.text(`（裝死中... 故意引誘你大意... 🤫）`);
    //await this.sleep(800);

    if (!AppStore.switchesState[targetIdx]) { await this.retractTentacle(targetIdx); return; }

    Dom.$terminalText.text(`騙到你了！高速秒殺！🤪⚡`);
    OctopusEngine.setMood('attacking', 'angry');
    OctopusEngine.targetLidProgress = 1.0;
    OctopusEngine.targetY = CONFIG.OCTOPUS_PEEK_Y;
    AudioEngine.playSqueak(true);

    OctopusEngine.targetTentacleProgress[targetIdx] = 1.0;

    if (AppStore.switchesState[targetIdx]) {
      AppStore.switchesState[targetIdx] = false;
      UIController.updateSwitchesHardwareUI();
      AudioEngine.playClick();
    }

    await this.sleep(500);
    await this.retractTentacle(targetIdx);
  },

  async executeMultiAttack(targetIndices) {
    Dom.$terminalText.text(`竟敢同時開兩個？！多觸手火力全開！🐙🔥`);
    OctopusEngine.setMood('angry', 'angry');

    OctopusEngine.targetX = CONFIG.OCTOPUS_IDLE_X;
    OctopusEngine.targetY = CONFIG.OCTOPUS_PEEK_Y;
    OctopusEngine.targetLidProgress = 1.0;
    AudioEngine.playWood();
    await this.sleep(350);

    AudioEngine.playSqueak(true);
    targetIndices.forEach(idx => { OctopusEngine.targetTentacleProgress[idx] = 1.0; });
    await this.sleep(1);

    targetIndices.forEach(idx => { AppStore.switchesState[idx] = false; });
    UIController.updateSwitchesHardwareUI();
    AudioEngine.playClick();

    await this.sleep(300);
    OctopusEngine.targetTentacleProgress = [0, 0, 0, 0, 0];
    await this.sleep(200);
  },

  async executeWiperSweep(targetIndices) {
    Dom.$terminalText.text(`本尊大抓狂！！！終極暴怒橫掃啟動！！！🧹💥`);
    OctopusEngine.setMood('angry', 'angry');

    OctopusEngine.targetX = CONFIG.OCTOPUS_IDLE_X;
    OctopusEngine.targetY = CONFIG.OCTOPUS_PEEK_Y;
    OctopusEngine.targetLidProgress = 1.0;
    AudioEngine.playWood();
    await this.sleep(350);

    for (const idx of targetIndices) {
      if (!AppStore.switchesState[idx]) continue;
      OctopusEngine.targetX = CONFIG.SWITCH_XS[idx];
      await this.sleep(80);

      OctopusEngine.targetTentacleProgress[idx] = 1.0;
      AudioEngine.playSqueak(false);
      await this.sleep(1);

      if (AppStore.switchesState[idx]) {
        AppStore.switchesState[idx] = false;
        UIController.updateSwitchesHardwareUI();
        AudioEngine.playClick();
      }
      await this.sleep(40);
      OctopusEngine.targetTentacleProgress[idx] = 0.0;
      await this.sleep(60);
    }

    OctopusEngine.setMood('moving', 'normal');
    await this.sleep(500);
  },

  async retractTentacle(idx) {
    OctopusEngine.targetTentacleProgress[idx] = 0.0;
    await this.sleep(160);
    OctopusEngine.setMood('moving', 'normal');
    await this.sleep(250);
  },
  
  returnToStandby() {
    OctopusEngine.setMood('idle', 'normal');
    OctopusEngine.targetX = CONFIG.OCTOPUS_IDLE_X;
    OctopusEngine.targetY = CONFIG.OCTOPUS_IDLE_Y;
    OctopusEngine.targetLidProgress = 0.0;
    Dom.$terminalText.text("哼，沒人能贏過我，繼續呼呼大睡... 💤");
    AppStore.isBusy = false;
    this.resetIdleTimer();
  },

  resetIdleTimer() {
    this.clearIdleTimer();
    CONFIG.IDLE_TIMEOUT_MS = (Math.floor(Math.random() * 10) + 5) * 1000;
    AppStore.idleTimer = setTimeout(async () => {
      if (AppStore.isBusy || AppStore.hasAnyActiveSwitch()) return;
      AppStore.isBusy = true;

      OctopusEngine.setMood('curious', 'normal');
      Dom.$terminalText.text(`外面好安靜... 偷偷推開蓋子看一眼... 👀`);
      OctopusEngine.targetLidProgress = 0.65;
      OctopusEngine.targetX = CONFIG.OCTOPUS_IDLE_X;
      OctopusEngine.targetY = 185;
      AudioEngine.playWood();
      await this.sleep(600);

      Dom.$terminalText.text(`（左瞧瞧... 右望望... 沒有人... 🥱）`);
      Dom.$leftPupil.attr('cx', '-24'); Dom.$rightPupil.attr('cx', '16');
      await this.sleep(800);
      Dom.$leftPupil.attr('cx', '-16'); Dom.$rightPupil.attr('cx', '24');
      await this.sleep(800);
      Dom.$leftPupil.attr('cx', '-20'); Dom.$rightPupil.attr('cx', '20');
      await this.sleep(400);

      AppStore.isBusy = false;
      if (AppStore.hasAnyActiveSwitch()) {
        SequenceBrain.processNextAction();
        return;
      }
      OctopusEngine.targetY = CONFIG.OCTOPUS_IDLE_Y;
      await this.sleep(180);
      OctopusEngine.targetLidProgress = 0.0;
      AudioEngine.playWood();
      await this.sleep(250);

      this.returnToStandby();
    }, CONFIG.IDLE_TIMEOUT_MS);
  },

  clearIdleTimer() {
    if (AppStore.idleTimer) clearTimeout(AppStore.idleTimer);
  }
};

/**
 * UI 視覺控制器層
 */
const UIController = {
  init() {
    this.bindEvents();
    this.updateSwitchesHardwareUI();
  },

  bindEvents() {
    Dom.$switchContainers.on('click', function () {
      const idx = parseInt($(this).attr('data-index'), 10);
      AudioEngine.playClick();
      AppStore.switchesState[idx] = !AppStore.switchesState[idx];
      UIController.updateSwitchesHardwareUI();
      setTimeout(() => { SequenceBrain.processNextAction(); }, 900);
    });

    Dom.$btnMute.on('click', function () {
      AudioEngine.isMuted = !AudioEngine.isMuted;
      if (AudioEngine.isMuted) {
        Dom.$btnMute.text('🔇 音效：靜音模式')
          .attr('class', "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-pointer");
      } else {
        Dom.$btnMute.text('🔊 音效：正常發聲')
          .attr('class', "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 cursor-pointer");
      }
    });

    Dom.$btnMulti.on('click', function () {
      if (AppStore.isBusy) return;
      AppStore.switchesState = [true, true, false, false, false];
      UIController.updateSwitchesHardwareUI();
      setTimeout(() => SequenceBrain.processNextAction(), 30);
    });

    Dom.$btnWiper.on('click', function () {
      if (AppStore.isBusy) return;
      AppStore.switchesState = [true, true, true, true, true];
      UIController.updateSwitchesHardwareUI();
      setTimeout(() => SequenceBrain.processNextAction(), 30);
    });

    $('body').one('click', function () { AudioEngine.init(); });
  },

  updateSwitchesHardwareUI() {
    Dom.$switchContainers.each(function (idx) {
      const $lever = $(this).find('.switch-lever');
      if (AppStore.switchesState[idx]) {
        $lever.css('transform', 'translateY(-6px) rotateX(-35deg)');
      } else {
        $lever.css('transform', 'translateY(4px) rotateX(35deg)');
      }
    });
  }
};

/**
 * jQuery Ready 入口
 */
$(function () {
  Dom = {
    $btnMute: $('#btn-mute'),
    $btnMulti: $('#btn-multi'),
    $btnWiper: $('#btn-wiper'),
    $terminalText: $('#terminal-text'),
    $octopusGroup: $('#octopus-group'),
    $octopusHead: $('#octopus-head'),
    $boxLid: $('#box-lid'),
    $lidHandle: $('#lid-handle'),
    $leftEyeWhite: $('#left-eye-white'),
    $rightEyeWhite: $('#right-eye-white'),
    $eyebrowLeft: $('#eyebrow-left'),
    $eyebrowRight: $('#eyebrow-right'),
    $leftPupil: $('#left-pupil'),
    $rightPupil: $('#right-pupil'),
    $mouthPath: $('#mouth-path'),
    $switchContainers: $('.switch-container')
  };

  OctopusEngine.init();
  UIController.init();
  SequenceBrain.resetIdleTimer();
});

