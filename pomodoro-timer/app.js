/**
 * PomoLog - Pomodoro Timer & Logger Javascript Controller
 * Dynamic state tracking, Web Audio API sound alert, local storage management, and CSV download compiler.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Circumference for SVG Progress Ring ---
  // radius = 130 -> 2 * PI * 130 = 816.81
  const CIRCUMFERENCE = 816.81;

  // --- App State ---
  let isRunning = false;
  let timerMode = 'focus'; // 'focus' or 'break'
  let focusDuration = 25; // minutes
  let breakDuration = 5; // minutes
  let timeLeft = focusDuration * 60; // seconds remaining
  let totalDuration = focusDuration * 60; // total seconds for progress
  let timerInterval = null;
  let alertVolume = 0.5; // 0 to 1
  let sessionStartTime = null;
  let sessionLogs = [];

  // --- DOM Elements ---
  const body = document.body;
  const timeCountdown = document.getElementById('time-countdown');
  const stateBadge = document.getElementById('state-badge');
  const timerProgress = document.getElementById('timer-progress');
  
  // Tabs & Buttons
  const modeFocusBtn = document.getElementById('mode-focus');
  const modeBreakBtn = document.getElementById('mode-break');
  const resetTimerBtn = document.getElementById('reset-timer-btn');
  const startPauseBtn = document.getElementById('start-pause-btn');
  const playPauseIcon = document.getElementById('play-pause-icon');
  const skipTimerBtn = document.getElementById('skip-timer-btn');
  
  // Objective Input
  const taskObjectiveInput = document.getElementById('task-objective-input');

  // Logs Table
  const sessionCountBadge = document.getElementById('session-count-badge');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const emptyLogsState = document.getElementById('empty-logs-state');
  const logsTableWrapper = document.getElementById('logs-table-wrapper');
  const logsTbody = document.getElementById('logs-tbody');

  // Settings Modal
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsFocusTime = document.getElementById('settings-focus-time');
  const settingsBreakTime = document.getElementById('settings-break-time');
  const settingsVolume = document.getElementById('settings-volume');
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  // Initialize Icons
  lucide.createIcons();

  // --- Initial Setup & Local Storage Load ---
  loadSettings();
  loadLogs();
  updateModeUI();
  resetTimer();

  // --- Timer Tick Cycle Logic ---
  function updateCountdownDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    timeCountdown.textContent = formattedTime;
    
    // Update tab document title
    const modeLabel = timerMode === 'focus' ? 'Focus' : 'Break';
    document.title = `(${formattedTime}) ${modeLabel} | PomoLog`;

    // Update circular progress bar
    const progressFraction = timeLeft / totalDuration;
    const offset = CIRCUMFERENCE - (progressFraction * CIRCUMFERENCE);
    timerProgress.style.strokeDashoffset = offset;
  }

  function startTimer() {
    if (isRunning) return;

    isRunning = true;
    sessionStartTime = new Date();
    
    // Set icon to pause
    playPauseIcon.setAttribute('data-lucide', 'pause');
    lucide.createIcons();
    startPauseBtn.title = 'Pause Session';

    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateCountdownDisplay();
      } else {
        completeSession();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!isRunning) return;

    isRunning = false;
    clearInterval(timerInterval);
    
    // Set icon to play
    playPauseIcon.setAttribute('data-lucide', 'play');
    lucide.createIcons();
    startPauseBtn.title = 'Resume Session';
  }

  function resetTimer() {
    pauseTimer();
    
    const durationMins = timerMode === 'focus' ? focusDuration : breakDuration;
    timeLeft = durationMins * 60;
    totalDuration = durationMins * 60;
    
    // Reset circular dashoffset to 0 (full circle)
    timerProgress.style.strokeDashoffset = 0;
    
    updateCountdownDisplay();
  }

  function skipSession() {
    pauseTimer();
    // Switch modes
    timerMode = timerMode === 'focus' ? 'break' : 'focus';
    updateModeUI();
    resetTimer();
    showToast(`Skipped to ${timerMode === 'focus' ? 'Focus Session' : 'Short Break'}`);
  }

  function completeSession() {
    pauseTimer();
    playAlarmSound();

    // Log focus session to DB (or break session if desired; standard Pomodoro tracks work focus sessions)
    saveSessionLog();
    
    // Show user feedback toast
    const nextMode = timerMode === 'focus' ? 'Short Break' : 'Focus Session';
    showToast(`${timerMode === 'focus' ? 'Focus' : 'Break'} session complete! Switch to ${nextMode}.`);

    // Switch mode
    timerMode = timerMode === 'focus' ? 'break' : 'focus';
    updateModeUI();
    resetTimer();
  }

  // --- UI Layout Updates ---
  function updateModeUI() {
    if (timerMode === 'focus') {
      body.className = 'state-focus-active';
      modeFocusBtn.classList.add('active');
      modeBreakBtn.classList.remove('active');
      stateBadge.textContent = 'FOCUS';
      stateBadge.className = 'state-badge focus-badge';
      timerProgress.style.stroke = 'var(--color-focus)';
    } else {
      body.className = 'state-break-active';
      modeBreakBtn.classList.add('active');
      modeFocusBtn.classList.remove('active');
      stateBadge.textContent = 'BREAK';
      stateBadge.className = 'state-badge break-badge';
      timerProgress.style.stroke = 'var(--color-break)';
    }
  }

  // Handle Tab Switch Actions
  modeFocusBtn.addEventListener('click', () => {
    if (timerMode === 'focus') return;
    if (isRunning && !confirm('Switching modes will interrupt and reset the current timer. Proceed?')) return;
    timerMode = 'focus';
    updateModeUI();
    resetTimer();
  });

  modeBreakBtn.addEventListener('click', () => {
    if (timerMode === 'break') return;
    if (isRunning && !confirm('Switching modes will interrupt and reset the current timer. Proceed?')) return;
    timerMode = 'break';
    updateModeUI();
    resetTimer();
  });

  // Start Pause Button
  startPauseBtn.addEventListener('click', () => {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  // Reset Button
  resetTimerBtn.addEventListener('click', () => {
    if (isRunning && !confirm('Are you sure you want to reset this session?')) return;
    resetTimer();
  });

  // Skip Button
  skipTimerBtn.addEventListener('click', () => {
    if (isRunning && !confirm('Skip current session and transition modes?')) return;
    skipSession();
  });

  // --- Alert Sound Oscillator Synthesizer ---
  function playAlarmSound() {
    if (alertVolume === 0) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (time, freq, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(alertVolume, time);
        // Exponential fade-out
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = audioCtx.currentTime;
      // Play high-frequency double beep (A5 / 880Hz)
      playBeep(now, 880, 0.15);
      playBeep(now + 0.25, 880, 0.3);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by user interaction restrictions:', e);
    }
  }

  // --- Database LocalStorage Logging ---
  function saveSessionLog() {
    const now = new Date();
    const durationMins = timerMode === 'focus' ? focusDuration : breakDuration;
    
    // Auto pull objective text
    let objective = 'Completed Short Break';
    if (timerMode === 'focus') {
      objective = taskObjectiveInput.value.trim() || 'Focus Session';
    }

    const logEntry = {
      id: Date.now(),
      date: now.toLocaleDateString(),
      startTime: sessionStartTime ? sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
      endTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: durationMins,
      type: timerMode === 'focus' ? 'Focus' : 'Break',
      objective: objective
    };

    sessionLogs.unshift(logEntry); // Insert at beginning (newest first)
    localStorage.setItem('pomolog_history', JSON.stringify(sessionLogs));
    
    // Clear task input only on completed focus session
    if (timerMode === 'focus') {
      taskObjectiveInput.value = '';
    }

    renderLogs();
  }

  function loadLogs() {
    const raw = localStorage.getItem('pomolog_history');
    sessionLogs = raw ? JSON.parse(raw) : [];
    renderLogs();
  }

  function renderLogs() {
    logsTbody.innerHTML = '';
    sessionCountBadge.textContent = `${sessionLogs.length} session${sessionLogs.length === 1 ? '' : 's'}`;

    if (sessionLogs.length === 0) {
      emptyLogsState.classList.remove('hidden');
      logsTableWrapper.classList.add('hidden');
      exportCsvBtn.disabled = true;
      return;
    }

    emptyLogsState.classList.add('hidden');
    logsTableWrapper.classList.remove('hidden');
    exportCsvBtn.disabled = false;

    sessionLogs.forEach((log) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="log-date">${log.date}</span>
          <span class="log-time">${log.startTime} - ${log.endTime}</span>
        </td>
        <td>
          <span class="type-tag ${log.type.toLowerCase()}">${log.type}</span>
        </td>
        <td>
          <span class="log-duration">${log.duration} min</span>
        </td>
        <td>
          <span class="log-objective" title="${log.objective}">${log.objective}</span>
        </td>
        <td style="text-align: center;">
          <button class="log-delete-btn" data-id="${log.id}" title="Delete record">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;

      // Set up individual delete listener
      tr.querySelector('.log-delete-btn').addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        if (confirm('Delete this record from history?')) {
          deleteLog(id);
        }
      });

      logsTbody.appendChild(tr);
    });

    lucide.createIcons();
  }

  function deleteLog(id) {
    sessionLogs = sessionLogs.filter(log => log.id !== id);
    localStorage.setItem('pomolog_history', JSON.stringify(sessionLogs));
    renderLogs();
    showToast('Record deleted.');
  }

  // Clear All Logs
  clearHistoryBtn.addEventListener('click', () => {
    if (sessionLogs.length === 0) return;
    if (confirm('Are you sure you want to permanently clear all local session logs? This cannot be undone.')) {
      sessionLogs = [];
      localStorage.removeItem('pomolog_history');
      renderLogs();
      showToast('Session logs cleared.');
    }
  });

  // --- CSV Exporter Output Engine ---
  exportCsvBtn.addEventListener('click', () => {
    if (sessionLogs.length === 0) return;

    // Headers row
    let csvContent = 'Date,Session Type,Duration (mins),Start Time,End Time,Objective/Task\n';

    // Build rows
    sessionLogs.forEach(log => {
      // Escape quotes in objective input
      const cleanObjective = log.objective.replace(/"/g, '""');
      
      const row = [
        `"${log.date}"`,
        `"${log.type}"`,
        log.duration,
        `"${log.startTime}"`,
        `"${log.endTime}"`,
        `"${cleanObjective}"`
      ].join(',');
      
      csvContent += row + '\n';
    });

    // Create Download Blob Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `pomolog_history_${dateStamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${fileName}`);
  });

  // --- Settings Configurations Modal Panel ---
  function loadSettings() {
    const focus = localStorage.getItem('pomolog_focus_mins');
    const bDuration = localStorage.getItem('pomolog_break_mins');
    const vol = localStorage.getItem('pomolog_volume');

    if (focus) focusDuration = parseInt(focus, 10);
    if (bDuration) breakDuration = parseInt(bDuration, 10);
    if (vol) alertVolume = parseFloat(vol);
  }

  openSettingsBtn.addEventListener('click', () => {
    // Populate form fields with current configs
    settingsFocusTime.value = focusDuration;
    settingsBreakTime.value = breakDuration;
    settingsVolume.value = Math.round(alertVolume * 100);
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  // Save Settings Configurations
  saveSettingsBtn.addEventListener('click', () => {
    const fVal = parseInt(settingsFocusTime.value, 10);
    const bVal = parseInt(settingsBreakTime.value, 10);
    const vVal = parseInt(settingsVolume.value, 10) / 100;

    if (isNaN(fVal) || fVal < 1 || fVal > 120 || isNaN(bVal) || bVal < 1 || bVal > 60) {
      alert('Please enter valid numeric time parameters (Focus: 1-120 mins, Break: 1-60 mins).');
      return;
    }

    focusDuration = fVal;
    breakDuration = bVal;
    alertVolume = vVal;

    localStorage.setItem('pomolog_focus_mins', focusDuration);
    localStorage.setItem('pomolog_break_mins', breakDuration);
    localStorage.setItem('pomolog_volume', alertVolume);

    settingsModal.classList.add('hidden');
    showToast('Settings saved.');

    // If timer is not running, reset it with new settings duration
    if (!isRunning) {
      resetTimer();
    }
  });

  // Reset Modal Defaults
  resetSettingsBtn.addEventListener('click', () => {
    settingsFocusTime.value = 25;
    settingsBreakTime.value = 5;
    settingsVolume.value = 50;
  });

  // Close modal when clicking outside the card
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  // --- Notification Toast Alert ---
  function showToast(message) {
    const existing = document.querySelector('.toast-notif');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.innerHTML = `
      <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }
});
