// main.js - Boxing Interval Timer full MVP logic
// Handles timer, YouTube, cues, controls, and UI updates.

// --- GLOBALS ---
let timer = null;
let timerState = 'idle'; // 'idle', 'work', 'rest', 'paused', 'finished'
let currentRound = 1;
let rounds = 3;
let workDuration = 120;
let restDuration = 30;
let remaining = 0;
let workLinks = [];
let restMedia = '';
let cueType = 'none';
let cueEnabled = true;
let cuePlayed = false;
let youTubePlayer = null;
let youTubeReady = false;
let restIsYouTube = false;
let restIsAudio = false;
let audioCuePlayer = null;
let pausedAt = 0;
let phase = 'work'; // 'work' or 'rest'

// --- DOM ---
const form = document.getElementById('config-form');
const youtubeLinksDiv = document.getElementById('youtube-links');
const roundsInput = document.getElementById('rounds');
const fillLinksBtn = document.getElementById('fill-links');
const timerArea = document.getElementById('timer-area');
const phaseDisplay = document.getElementById('phase-display');
const roundDisplay = document.getElementById('round-display');
const timeDisplay = document.getElementById('time-display');
const pauseBtn = document.getElementById('pause');
const resumeBtn = document.getElementById('resume');
const resetBtn = document.getElementById('reset');
const youTubeDiv = document.getElementById('youtube-player');
const audioCue = document.getElementById('audio-cue-player');
const fallback = document.getElementById('fallback');
const notificationBanner = document.getElementById('notification-banner');

// --- YOUTUBE IFRAME API LOADER ---
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    youTubeReady = true;
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.body.appendChild(tag);
}
window.onYouTubeIframeAPIReady = function() {
  youTubeReady = true;
};

// --- YOUTUBE PLAYER CONTROL ---
function playYouTube(url, startSeconds = 0, onReadyCallback) {
  const videoId = extractYouTubeID(url);
  if (!videoId) {
    showFallback('Invalid or missing YouTube URL.');
    return;
  }
  youTubeDiv.innerHTML = '<div id="yt-embed"></div>';
  youTubePlayer = new YT.Player('yt-embed', {
    height: '200', width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 1, controls: 0, modestbranding: 1, rel: 0, fs: 0, playsinline: 1, start: startSeconds
    },
    events: {
      onReady: (e) => {
        e.target.seekTo(startSeconds);
        e.target.playVideo();
        if (onReadyCallback) onReadyCallback();
      },
      onError: () => {
        showFallback('YouTube video failed to load.');
      }
    }
  });
}
function stopYouTube() {
  if (youTubePlayer && youTubePlayer.stopVideo) {
    youTubePlayer.stopVideo();
    youTubePlayer.destroy();
    youTubePlayer = null;
  }
  youTubeDiv.innerHTML = '';
}
function extractYouTubeID(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu.be\/|embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

// --- AUDIO CUE CONTROL ---
function playCue(type) {
  if (!type || type === 'none') return;
  // Use both .wav and .mp3 sources for best compatibility
  audioCue.innerHTML = `
    <source src="audio-cues/${type}.wav" type="audio/wav">
    <source src="audio-cues/${type}.mp3" type="audio/mpeg">
  `;
  audioCue.load();
  audioCue.currentTime = 0;
  audioCue.play();
}

// --- TIMER ENGINE ---
function updatePhaseDisplay() {
  const el = document.getElementById('phase-display');
  if (!el) return;
  el.className = '';
  if (phase === 'work') el.classList.add('work');
  else if (phase === 'rest') el.classList.add('rest');
  else if (phase === 'warmup') el.classList.add('warmup');
  else if (phase === 'cooldown') el.classList.add('cooldown');
  else if (phase === 'finished') el.classList.add('finished');
}

function startTimer() {
  if (window.warmupEnabled && window.warmupUrl) {
    timerState = 'warmup';
    phase = 'warmup';
    cuePlayed = false;
    updateUI();
    playYouTube(window.warmupUrl, window.warmupStart || 0);
    runCountdown(window.warmupDuration);
  } else {
    startMainWorkout();
  }
}

function startMainWorkout() {
  timerState = 'work';
  phase = 'work';
  currentRound = 1;
  cuePlayed = false;
  updateUI();
  playPhaseMedia();
  runCountdown(workDuration);
}
function runCountdown(sec) {
  remaining = sec;
  updateUI();
  timer = setInterval(() => {
    if (timerState === 'paused') return;
    remaining--;
    // Play cue X seconds before transition
    if (cueEnabled && cueType !== 'none' && remaining === window.cueTiming && !cuePlayed) {
      playCue(cueType);
      cuePlayed = true;
    }
    updateUI();
    if (remaining <= 0) {
      clearInterval(timer);
      nextPhase();
    }
  }, 1000);
}
function nextPhase() {
  cuePlayed = false;
  if (phase === 'warmup') {
    stopYouTube();
    startMainWorkout();
  } else if (phase === 'work') {
    // End of work, go to rest
    stopYouTube();
    if (restIsYouTube && restMedia) {
      phase = 'rest';
      timerState = 'rest';
      playYouTube(restMedia, window.restStartTime || 0);
    } else if (restIsAudio && restMedia) {
      phase = 'rest';
      timerState = 'rest';
      audioCue.src = restMedia;
      audioCue.loop = true;
      audioCue.play();
    } else {
      phase = 'rest';
      timerState = 'rest';
    }
    runCountdown(restDuration);
  } else if (phase === 'rest') {
    // End of rest, next round or finish
    if (restIsAudio && restMedia) {
      audioCue.pause();
      audioCue.loop = false;
    }
    currentRound++;
    if (currentRound > rounds) {
      // All rounds done
      if (window.cooldownEnabled && window.cooldownUrl) {
        phase = 'cooldown';
        timerState = 'cooldown';
        cuePlayed = false;
        updateUI();
        playYouTube(window.cooldownUrl, window.cooldownStart || 0);
        runCountdown(window.cooldownDuration);
      } else {
        finishWorkout();
      }
    } else {
      phase = 'work';
      timerState = 'work';
      playPhaseMedia();
      runCountdown(workDuration);
    }
  } else if (phase === 'cooldown') {
    stopYouTube();
    finishWorkout();
  }
}
function playPhaseMedia() {
  if (phase === 'work') {
    stopYouTube();
    playYouTube(workLinks[currentRound-1], window.workStartTimes ? window.workStartTimes[currentRound-1] : 0);
  }
}
function finishWorkout() {
  timerState = 'finished';
  stopYouTube();
  playCue(cueType !== 'none' ? cueType : 'ding');
  updateUI();
}
function pauseTimer() {
  timerState = 'paused';
  clearInterval(timer);
  if (youTubePlayer && youTubePlayer.pauseVideo) youTubePlayer.pauseVideo();
  if (restIsAudio && restMedia) audioCue.pause();
}
function resumeTimer() {
  if (timerState !== 'paused') return;
  timerState = phase;
  if (phase === 'work') {
    if (youTubePlayer && youTubePlayer.playVideo) youTubePlayer.playVideo();
  } else if (restIsAudio && restMedia) {
    audioCue.play();
  }
  runCountdown(remaining);
}
function resetTimer() {
  clearInterval(timer);
  stopYouTube();
  if (restIsAudio && restMedia) {
    audioCue.pause();
    audioCue.loop = false;
  }
  timerState = 'idle';
  currentRound = 1;
  cuePlayed = false;
  updateUI();
}

// --- UI HANDLERS ---
function updateUI() {
  // Show/hide timer area
  if (timerState === 'idle' || timerState === 'finished') {
    timerArea.classList.add('hidden');
    form.classList.remove('hidden');
  } else {
    timerArea.classList.remove('hidden');
    form.classList.add('hidden');
  }
  // Phase display
  if (timerState === 'warmup') {
    phaseDisplay.textContent = 'Warm-Up';
  } else if (timerState === 'cooldown') {
    phaseDisplay.textContent = 'Cool-Down';
  } else if (timerState === 'work') {
    phaseDisplay.textContent = 'Work';
  } else if (timerState === 'rest') {
    phaseDisplay.textContent = 'Rest';
  } else if (timerState === 'finished') {
    phaseDisplay.textContent = 'Done!';
  } else {
    phaseDisplay.textContent = '';
  }
  // Round/phase display
  if (timerState === 'work' || timerState === 'rest') {
    roundDisplay.textContent = `Round ${currentRound} of ${rounds}`;
  } else if (timerState === 'warmup') {
    roundDisplay.textContent = 'Warm-Up';
  } else if (timerState === 'cooldown') {
    roundDisplay.textContent = 'Cool-Down';
  } else if (timerState === 'finished') {
    roundDisplay.textContent = 'Session Complete!';
  } else {
    roundDisplay.textContent = '';
  }
  // Time display
  if (timerState === 'work' || timerState === 'rest' || timerState === 'warmup' || timerState === 'cooldown') {
    timeDisplay.textContent = formatTime(remaining);
  } else {
    timeDisplay.textContent = '';
  }
  // Controls
  if (timerState === 'paused') {
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
  } else if (timerState === 'work' || timerState === 'rest') {
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
  } else {
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
  }
}
function formatTime(sec) {
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}
function showFallback(msg) {
  fallback.textContent = msg;
  fallback.classList.remove('hidden');
  timerArea.classList.add('hidden');
}

// --- YOUTUBE INPUT DYNAMIC RENDER ---
function renderYouTubeInputs(rounds) {
  youtubeLinksDiv.innerHTML = '';
  for (let i = 0; i < rounds; i++) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '0.5em';
    wrapper.style.marginBottom = '0.25em';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `YouTube URL for Round ${i+1}`;
    input.className = 'youtube-link';
    input.required = true;
    input.style.flex = '2';
    const startInput = document.createElement('input');
    startInput.type = 'text';
    startInput.placeholder = 'Start (mm:ss or s)';
    startInput.className = 'youtube-start';
    startInput.style.flex = '1';
    wrapper.appendChild(input);
    wrapper.appendChild(startInput);
    youtubeLinksDiv.appendChild(wrapper);
  }
}

// --- WARMUP/COOLDOWN TOGGLE ---
document.getElementById('enable-warmup').addEventListener('change', (e) => {
  document.getElementById('warmup-fields').classList.toggle('hidden', !e.target.checked);
});
document.getElementById('enable-cooldown').addEventListener('change', (e) => {
  document.getElementById('cooldown-fields').classList.toggle('hidden', !e.target.checked);
});

// --- NOTIFICATION UTILS ---
function showNotification(msg, duration = 2000) {
  const n = document.getElementById('notification');
  n.textContent = msg;
  n.classList.remove('hidden');
  if (showNotification._timeout) clearTimeout(showNotification._timeout);
  showNotification._timeout = setTimeout(() => n.classList.add('hidden'), duration);
}

// --- EVENT LISTENERS ---
roundsInput.addEventListener('input', (e) => {
  let rounds = parseInt(e.target.value, 10);
  if (isNaN(rounds) || rounds < 1) rounds = 1;
  if (rounds > 20) rounds = 20;
  renderYouTubeInputs(rounds);
  // Repopulate YouTube links and start times if present in memory
  if (window._presetRestore) {
    const {workLinks, workStartTimes} = window._presetRestore;
    const wrappers = Array.from(youtubeLinksDiv.children);
    wrappers.forEach((w, i) => {
      if (workLinks && workLinks[i]) w.querySelector('.youtube-link').value = workLinks[i];
      if (workStartTimes && workStartTimes[i] != null) w.querySelector('.youtube-start').value = workStartTimes[i];
    });
    window._presetRestore = null;
  }
});

// --- SAVE/LOAD WORKOUT ---
document.getElementById('save-preset').addEventListener('click', () => {
  try {
    const wrappers = Array.from(youtubeLinksDiv.children);
    const preset = {
      workDuration: document.getElementById('work-duration').value,
      restDuration: document.getElementById('rest-duration').value,
      rounds: document.getElementById('rounds').value,
      workLinks: wrappers.map(w => w.querySelector('.youtube-link').value),
      workStartTimes: wrappers.map(w => w.querySelector('.youtube-start').value),
      restMedia: document.getElementById('rest-media').value,
      restStartTime: document.getElementById('rest-start-time').value,
      cueType: document.getElementById('audio-cue').value,
      cueEnabled: document.getElementById('cue-enabled').checked,
      cueTiming: document.getElementById('cue-timing').value
    };
    localStorage.setItem('boxing-interval-preset', JSON.stringify(preset));
    showNotification('💾 Workout saved!');
  } catch (e) {
    showNotification('❌ Failed to save: ' + e.message, 3500);
  }
});
document.getElementById('load-preset').addEventListener('click', () => {
  try {
    const preset = JSON.parse(localStorage.getItem('boxing-interval-preset'));
    if (!preset) return showNotification('⚠️ No saved workout found.');
    document.getElementById('work-duration').value = preset.workDuration;
    document.getElementById('rest-duration').value = preset.restDuration;
    document.getElementById('rounds').value = preset.rounds;
    renderYouTubeInputs(parseInt(preset.rounds, 10));
    // Save for after render
    window._presetRestore = {workLinks: preset.workLinks, workStartTimes: preset.workStartTimes};
    // Set rest and cues
    document.getElementById('rest-media').value = preset.restMedia || '';
    document.getElementById('rest-start-time').value = preset.restStartTime || '';
    document.getElementById('audio-cue').value = preset.cueType || 'none';
    document.getElementById('cue-enabled').checked = !!preset.cueEnabled;
    document.getElementById('cue-timing').value = preset.cueTiming || 10;
    // Repopulate dynamic fields
    setTimeout(() => {
      const wrappers = Array.from(youtubeLinksDiv.children);
      if (preset.workLinks) wrappers.forEach((w, i) => w.querySelector('.youtube-link').value = preset.workLinks[i] || '');
      if (preset.workStartTimes) wrappers.forEach((w, i) => w.querySelector('.youtube-start').value = preset.workStartTimes[i] || '');
    }, 0);
    alert('Workout loaded!');
  } catch (e) {
    alert('Failed to load workout: ' + e.message);
  }
});
fillLinksBtn.addEventListener('click', () => {
  const first = youtubeLinksDiv.querySelector('.youtube-link');
  if (!first) return;
  const val = first.value;
  youtubeLinksDiv.querySelectorAll('.youtube-link').forEach(inp => inp.value = val);
  // Do NOT autofill start time fields
});

pauseBtn.addEventListener('click', pauseTimer);
resumeBtn.addEventListener('click', resumeTimer);
resetBtn.addEventListener('click', resetTimer);

// --- FORM SUBMISSION (START WORKOUT) ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  // Gather config
  workDuration = parseInt(document.getElementById('work-duration').value, 10);
  restDuration = parseInt(document.getElementById('rest-duration').value, 10);
  rounds = parseInt(document.getElementById('rounds').value, 10);
  // Get round links and start times
  const wrappers = Array.from(youtubeLinksDiv.children);
  workLinks = wrappers.map(w => w.querySelector('.youtube-link').value.trim());
  window.workStartTimes = wrappers.map(w => parseStartTime(w.querySelector('.youtube-start').value.trim()));
  restMedia = document.getElementById('rest-media').value.trim();
  window.restStartTime = parseStartTime(document.getElementById('rest-start-time').value.trim());
  cueType = document.getElementById('audio-cue').value;
  cueEnabled = document.getElementById('cue-enabled').checked;
  window.cueTiming = parseInt(document.getElementById('cue-timing').value, 10) || 10;
  cuePlayed = false;
  // Detect rest media type
  restIsYouTube = restMedia && extractYouTubeID(restMedia);
  restIsAudio = restMedia && !restIsYouTube;
  // Warm-up & Cool-down
  window.warmupEnabled = document.getElementById('enable-warmup').checked;
  window.cooldownEnabled = document.getElementById('enable-cooldown').checked;
  window.warmupUrl = document.getElementById('warmup-url').value.trim();
  window.warmupStart = parseStartTime(document.getElementById('warmup-start').value.trim());
  window.warmupDuration = parseInt(document.getElementById('warmup-duration').value, 10) || 0;
  window.cooldownUrl = document.getElementById('cooldown-url').value.trim();
  window.cooldownStart = parseStartTime(document.getElementById('cooldown-start').value.trim());
  window.cooldownDuration = parseInt(document.getElementById('cooldown-duration').value, 10) || 0;
  fallback.classList.add('hidden');
  // Start!
  loadYouTubeAPI();
  // Wait for user gesture, then start timer after YT API ready
  function waitForYTAndStart() {
    if (youTubeReady) {
      startTimer();
    } else {
      setTimeout(waitForYTAndStart, 100);
    }
  }
  waitForYTAndStart();
});

// --- TIME PARSER ---
function parseStartTime(val) {
  if (!val) return 0;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  const mmss = val.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  return 0;
}

// --- INITIAL RENDER ---
renderYouTubeInputs(parseInt(roundsInput.value, 10));
updateUI();
loadYouTubeAPI();
