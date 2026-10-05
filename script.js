/**
 * SMART STUDY AI — APPLICATION CONTROLLER
 * "Learn Smarter. Study Better."
 *
 * Main client-side controller managing:
 * - Reactive dashboard and metrics synchronization
 * - Tab navigation and mobile drawer interactions
 * - Conversational AI study tutor with response latency simulation
 * - Lecture notes summarizer with structured study output
 * - 5-Question interactive multiple-choice quiz engine with score breakdown
 * - Progress analytics tracking and persistent study session logging
 * - Global error boundaries and defensive localStorage management
 *
 * @module script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Extract utilities from SmartStudyUtils (fallback to window or inline safe defaults)
  const utils = (typeof window !== 'undefined' && window.SmartStudyUtils) ? window.SmartStudyUtils : {};

  const DEFAULT_USER_DATA = utils.DEFAULT_USER_DATA || {
    userName: "Alex Morgan",
    streak: 7,
    quizScore: 85,
    topicsCompleted: 12,
    totalTopics: 15,
    studyHours: 18,
    targetHours: 20,
    quizzesTaken: 4
  };

  const DEFAULT_QUIZ_DATA = utils.DEFAULT_QUIZ_DATA || [];
  const safeLoadData = utils.safeLoadData || ((storage) => ({ data: { ...DEFAULT_USER_DATA }, wasRestoredFromDefault: false }));
  const safeSaveData = utils.safeSaveData || ((data, storage) => ({ success: true, sanitizedData: data, error: null }));
  const validateQuizData = utils.validateQuizData || ((q) => ({ isValid: Array.isArray(q) && q.length > 0, validQuestions: q, errors: [] }));
  const calculateQuizScore = utils.calculateQuizScore || ((ans, q) => ({ score: 0, total: 5, percentage: 0, correctCount: 0, incorrectCount: 0 }));
  const calculateProgressPercentage = utils.calculateProgressPercentage || ((cur, tgt) => Math.min(100, Math.round((Number(cur) / Number(tgt)) * 100) || 0));
  const validateNotesInput = utils.validateNotesInput || ((txt) => ({ isValid: typeof txt === 'string' && txt.trim().length > 0, sanitizedText: (txt || '').trim(), error: null }));
  const processNotesSummary = utils.processNotesSummary || ((txt) => ({ keyPoints: [], terms: [], quickRevision: '' }));
  const validateTutorQuery = utils.validateTutorQuery || ((q) => ({ isValid: typeof q === 'string' && q.trim().length > 0, sanitizedQuery: (q || '').trim(), error: null }));
  const generateTutorResponse = utils.generateTutorResponse || ((q) => ({ topic: 'Concept', content: '<p>Explanation</p>' }));
  const escapeHtml = utils.escapeHtml || ((s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  // ==========================================================================
  // 1. GLOBAL ERROR BOUNDARIES & FRIENDLY NOTIFICATIONS
  // ==========================================================================

  /**
   * Displays a user-friendly error notification and safely logs diagnostic details
   * to the browser console without exposing raw stack traces to the student.
   *
   * @param {string} friendlyMessage - Clean message suitable for UI display.
   * @param {unknown} [technicalContext] - Technical error object or context for console diagnostics.
   */
  function showError(friendlyMessage, technicalContext) {
    if (technicalContext) {
      console.error("[SmartStudy Error Boundary]:", friendlyMessage, technicalContext);
    }
    showToast(friendlyMessage || "Something went wrong. Please try again. ⚠️", 4000);
  }

  // Window-level uncaught error handler
  window.addEventListener('error', (event) => {
    console.error("[Global Error Caught]:", event.message, event.error);
    showError("An unexpected error occurred. Please refresh or retry.", event.error);
  });

  // Window-level unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error("[Unhandled Promise Rejection]:", event.reason);
    showError("A background operation could not be completed. Please try again.", event.reason);
  });

  // ==========================================================================
  // 2. DATA STORE & LOCALSTORAGE MANAGEMENT
  // ==========================================================================

  /**
   * Active in-memory student progress state.
   * Loaded safely from localStorage with schema validation and defaults fallback.
   * @type {typeof DEFAULT_USER_DATA}
   */
  let userData;

  try {
    const loadResult = safeLoadData(window.localStorage, 'smartStudyAI_data');
    userData = loadResult.data;
    if (loadResult.wasRestoredFromDefault && loadResult.errorMessage) {
      console.info("[Storage Restoration]:", loadResult.errorMessage);
    }
  } catch (err) {
    showError("Unable to load saved study progress. Using default session.", err);
    userData = { ...DEFAULT_USER_DATA };
  }

  /**
   * Saves student progress data to localStorage and updates UI metrics.
   * Defensively catches quota errors and schema discrepancies.
   *
   * @param {typeof DEFAULT_USER_DATA} data - Data to persist.
   * @returns {boolean} True if successfully saved; false otherwise.
   */
  function persistUserData(data) {
    try {
      const result = safeSaveData(data, window.localStorage, 'smartStudyAI_data');
      if (!result.success) {
        showError(result.error || "Unable to save your progress to browser storage.");
      }
      userData = result.sanitizedData;
      updateAllMetricDisplays(userData);
      return result.success;
    } catch (err) {
      showError("Failed to update progress storage.", err);
      updateAllMetricDisplays(userData);
      return false;
    }
  }

  /**
   * Synchronizes all numerical metrics, progress bars, and badges across
   * the Dashboard and Progress tabs using bounded mathematical calculations.
   *
   * @param {typeof DEFAULT_USER_DATA} data - Current student data.
   */
  function updateAllMetricDisplays(data) {
    try {
      // Dashboard metric values
      const dashStreak = document.getElementById('dashStreak');
      const dashStreakHeader = document.getElementById('dashStreakHeader');
      const dashQuizScore = document.getElementById('dashQuizScore');
      const dashTopics = document.getElementById('dashTopics');
      const dashHours = document.getElementById('dashHours');

      if (dashStreak) dashStreak.textContent = String(data.streak);
      if (dashStreakHeader) dashStreakHeader.textContent = String(data.streak);
      if (dashQuizScore) dashQuizScore.textContent = String(data.quizScore);
      if (dashTopics) dashTopics.textContent = String(data.topicsCompleted);
      if (dashHours) dashHours.textContent = String(data.studyHours);

      // Progress tab metric values
      const progStreak = document.getElementById('progStreak');
      const progQuizScore = document.getElementById('progQuizScore');
      const progTopics = document.getElementById('progTopics');
      const progHours = document.getElementById('progHours');
      const progScoreBar = document.getElementById('progScoreBar');
      const progTopicsBar = document.getElementById('progTopicsBar');
      const progHoursBar = document.getElementById('progHoursBar');

      if (progStreak) progStreak.innerHTML = `${data.streak} <span class="unit">days</span>`;
      if (progQuizScore) progQuizScore.innerHTML = `${data.quizScore}<span class="unit">%</span>`;
      if (progTopics) progTopics.innerHTML = `${data.topicsCompleted} <span class="unit">/ ${data.totalTopics}</span>`;
      if (progHours) progHours.innerHTML = `${data.studyHours}<span class="unit">h</span>`;

      // Safe progress bar percentages using utility calculations
      const scorePercent = calculateProgressPercentage(data.quizScore, 100);
      const topicsPercent = calculateProgressPercentage(data.topicsCompleted, data.totalTopics);
      const hoursPercent = calculateProgressPercentage(data.studyHours, data.targetHours);

      if (progScoreBar) progScoreBar.style.width = `${scorePercent}%`;
      if (progTopicsBar) progTopicsBar.style.width = `${topicsPercent}%`;
      if (progHoursBar) progHoursBar.style.width = `${hoursPercent}%`;
    } catch (err) {
      showError("Error refreshing dashboard stats display.", err);
    }
  }

  // Initial render of all metric displays
  updateAllMetricDisplays(userData);

  // Reset Demo Button Handler
  const resetDemoBtn = document.getElementById('resetDemoBtn');
  if (resetDemoBtn) {
    resetDemoBtn.addEventListener('click', () => {
      try {
        userData = { ...DEFAULT_USER_DATA };
        persistUserData(userData);
        showToast('Demo data reset to original defaults! 🔄');
      } catch (err) {
        showError("Failed to reset demo data.", err);
      }
    });
  }

  // ==========================================================================
  // 3. TAB NAVIGATION & MOBILE DRAWER
  // ==========================================================================
  const navItems = document.querySelectorAll('.nav-item');
  const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  /**
   * Switches the active application tab view and synchronizes navigation states.
   *
   * @param {string} tabId - Target tab identifier ('dashboard', 'ai-tutor', etc.).
   */
  function switchTab(tabId) {
    try {
      // Hide all panels
      tabPanels.forEach(panel => panel.classList.remove('active'));

      // Show target panel
      const targetPanel = document.getElementById(`tab-${tabId}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      } else {
        console.warn(`Tab panel #tab-${tabId} not found.`);
        return;
      }

      // Update sidebar nav active classes
      navItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Update mobile bottom nav active classes
      mobileNavBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      closeMobileSidebar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showError("Navigation error. Please click the desired tab again.", err);
    }
  }

  // Attach tab navigation listeners
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  mobileNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  }

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Dashboard Quick Action Triggers
  const actionAskAI = document.getElementById('actionAskAI');
  const actionSummarize = document.getElementById('actionSummarize');
  const actionTakeQuiz = document.getElementById('actionTakeQuiz');

  if (actionAskAI) {
    actionAskAI.addEventListener('click', () => {
      switchTab('ai-tutor');
      const chatInput = document.getElementById('chatInput');
      if (chatInput) chatInput.focus();
    });
  }

  if (actionSummarize) {
    actionSummarize.addEventListener('click', () => {
      switchTab('summarizer');
      const notesInput = document.getElementById('notesInput');
      if (notesInput) notesInput.focus();
    });
  }

  if (actionTakeQuiz) {
    actionTakeQuiz.addEventListener('click', () => {
      switchTab('quiz');
    });
  }

  // Dashboard Recommended Topics buttons
  const askTopicBtns = document.querySelectorAll('.ask-topic-btn');
  askTopicBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      if (query) {
        switchTab('ai-tutor');
        sendChatMessage(query);
      }
    });
  });

  // ==========================================================================
  // 4. AI TUTOR (CHAT & CONVERSATION ENGINE)
  // ==========================================================================
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const typingIndicator = document.getElementById('typingIndicator');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const promptChips = document.querySelectorAll('.chip-btn');

  let lastAiTopic = "Photosynthesis";

  /**
   * Appends a student question bubble to the chat container.
   *
   * @param {string} text - User question text.
   */
  function appendUserMessage(text) {
    if (!chatMessages) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `
      <div class="bubble-avatar">AM</div>
      <div class="bubble-body">
        <div class="bubble-content">
          <p>${escapeHtml(text)}</p>
        </div>
      </div>
    `;
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
  }

  /**
   * Appends an AI Tutor response bubble with follow-up action buttons.
   *
   * @param {string} htmlContent - Pre-sanitized HTML response content.
   * @param {string} [topicName] - Topic name to track for follow-up prompts.
   */
  function appendAiMessage(htmlContent, topicName) {
    if (!chatMessages) return;
    if (topicName) lastAiTopic = topicName;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai';
    bubble.innerHTML = `
      <div class="bubble-avatar">🤖</div>
      <div class="bubble-body">
        <div class="bubble-sender">Smart Study AI Tutor <span class="bubble-time">${timeStr}</span></div>
        <div class="bubble-content">${htmlContent}</div>
        <div class="bubble-actions">
          <button class="tutor-action-btn" data-action="explain">Explain Simply</button>
          <button class="tutor-action-btn" data-action="example">Give Example</button>
          <button class="tutor-action-btn" data-action="ask">Ask Another Question</button>
        </div>
      </div>
    `;
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
    bindTutorActionButtons(bubble);
  }

  function scrollChatToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function showTypingIndicator() {
    if (typingIndicator && chatMessages) {
      typingIndicator.classList.remove('hidden');
      chatMessages.appendChild(typingIndicator);
      scrollChatToBottom();
    }
  }

  function hideTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.classList.add('hidden');
    }
  }

  /**
   * Handles user chat message submission with input validation and defensive error boundary.
   *
   * @param {string} rawText - Unsanitized candidate question text.
   */
  function sendChatMessage(rawText) {
    const validation = validateTutorQuery(rawText);

    if (!validation.isValid) {
      showError(validation.error || "Please enter a valid study question.");
      if (chatInput) chatInput.focus();
      return;
    }

    const cleanText = validation.sanitizedQuery;
    appendUserMessage(cleanText);
    showTypingIndicator();

    // Realistic demo latency
    setTimeout(() => {
      try {
        hideTypingIndicator();
        const response = generateTutorResponse(cleanText);
        appendAiMessage(response.content, response.topic);
      } catch (err) {
        hideTypingIndicator();
        showError("The AI Tutor encountered an unexpected issue generating an answer. Please try again.", err);
      }
    }, 600);
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value;
      chatInput.value = '';
      sendChatMessage(text);
    });
  }

  // Quick Chips Click Handlers
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) sendChatMessage(prompt);
    });
  });

  // Action Buttons under AI bubbles
  function bindTutorActionButtons(container) {
    const buttons = container.querySelectorAll('.tutor-action-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'explain') {
          handleTutorActionExplain();
        } else if (action === 'example') {
          handleTutorActionExample();
        } else if (action === 'ask') {
          handleTutorActionAsk();
        }
      });
    });
  }

  function handleTutorActionExplain() {
    sendChatMessage(`Explain ${lastAiTopic} simply`);
  }

  function handleTutorActionExample() {
    sendChatMessage(`Give me a real-world example of ${lastAiTopic}`);
  }

  function handleTutorActionAsk() {
    if (chatInput) {
      chatInput.focus();
      chatInput.placeholder = `Ask anything about ${lastAiTopic}...`;
      showToast(`Type your question about ${lastAiTopic} below 👇`);
    }
  }

  bindTutorActionButtons(document);

  if (clearChatBtn && chatMessages) {
    clearChatBtn.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="chat-bubble ai">
          <div class="bubble-avatar">🤖</div>
          <div class="bubble-body">
            <div class="bubble-sender">Smart Study AI Tutor <span class="bubble-time">Just now</span></div>
            <div class="bubble-content">
              <p>Chat cleared! Ready for your next study topic. What would you like to review?</p>
            </div>
            <div class="bubble-actions">
              <button class="tutor-action-btn" data-action="explain">Explain Simply</button>
              <button class="tutor-action-btn" data-action="example">Give Example</button>
              <button class="tutor-action-btn" data-action="ask">Ask Another Question</button>
            </div>
          </div>
        </div>
      `;
      bindTutorActionButtons(chatMessages);
      showToast('Chat history cleared 🧹');
    });
  }

  // ==========================================================================
  // 5. NOTES SUMMARIZER ENGINE
  // ==========================================================================
  const notesInput = document.getElementById('notesInput');
  const charCount = document.getElementById('charCount');
  const clearNotesBtn = document.getElementById('clearNotesBtn');
  const loadSampleNotesBtn = document.getElementById('loadSampleNotesBtn');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const copySummaryBtn = document.getElementById('copySummaryBtn');

  const summaryEmptyState = document.getElementById('summaryEmptyState');
  const summaryLoading = document.getElementById('summaryLoading');
  const summaryContent = document.getElementById('summaryContent');

  const summaryKeyPoints = document.getElementById('summaryKeyPoints');
  const summaryTerms = document.getElementById('summaryTerms');
  const summaryRevision = document.getElementById('summaryRevision');

  const SAMPLE_COLLEGE_NOTES = `Cellular Respiration and ATP Synthesis:
Cellular respiration is the biochemical pathway through which eukaryotic cells break down glucose molecules to harvest energy in the form of Adenosine Triphosphate (ATP). The overall process consists of three main stages: Glycolysis, the Krebs Cycle (Citric Acid Cycle), and Oxidative Phosphorylation via the Electron Transport Chain (ETC).

Glycolysis occurs in the cytosol without requiring oxygen (anaerobic). It cleaves one 6-carbon glucose molecule into two 3-carbon pyruvate molecules, generating a net yield of 2 ATP and 2 NADH. The pyruvate molecules are subsequently transported into the mitochondrial matrix, where the Krebs Cycle oxidizes acetyl-CoA, producing electron carriers (NADH and FADH2) alongside carbon dioxide as a metabolic byproduct.

Finally, oxidative phosphorylation occurs along the inner mitochondrial cristae. Electrons donated by NADH and FADH2 pass through transmembrane protein complexes (Complexes I-IV), pumping hydrogen ions (protons) into the intermembrane space to create an electrochemical proton gradient. The reflux of protons through ATP Synthase harnesses the proton-motive force to synthesize approximately 30 to 32 ATP molecules per glucose molecule. Oxygen functions as the final electron acceptor, combining with free protons to form water.`;

  if (notesInput && charCount) {
    notesInput.addEventListener('input', () => {
      const len = notesInput.value.length;
      charCount.textContent = `${len.toLocaleString()} character${len === 1 ? '' : 's'}`;
    });
  }

  if (loadSampleNotesBtn && notesInput) {
    loadSampleNotesBtn.addEventListener('click', () => {
      notesInput.value = SAMPLE_COLLEGE_NOTES;
      notesInput.dispatchEvent(new Event('input'));
      showToast('Sample Biology notes loaded! Click "Generate Summary" 🚀');
    });
  }

  if (clearNotesBtn && notesInput) {
    clearNotesBtn.addEventListener('click', () => {
      notesInput.value = '';
      notesInput.dispatchEvent(new Event('input'));
      if (summaryEmptyState) summaryEmptyState.classList.remove('hidden');
      if (summaryLoading) summaryLoading.classList.add('hidden');
      if (summaryContent) summaryContent.classList.add('hidden');
      showToast('Notes input cleared.');
    });
  }

  if (generateSummaryBtn && notesInput) {
    generateSummaryBtn.addEventListener('click', () => {
      const rawText = notesInput.value;
      const validation = validateNotesInput(rawText);

      if (!validation.isValid) {
        showError(validation.error || "Please enter valid notes to summarize.");
        notesInput.focus();
        return;
      }

      // Show loading spinner
      if (summaryEmptyState) summaryEmptyState.classList.add('hidden');
      if (summaryContent) summaryContent.classList.add('hidden');
      if (summaryLoading) summaryLoading.classList.remove('hidden');

      setTimeout(() => {
        try {
          if (summaryLoading) summaryLoading.classList.add('hidden');
          const summaryData = processNotesSummary(validation.sanitizedText);
          renderSummaryContent(summaryData);
          if (summaryContent) summaryContent.classList.remove('hidden');
          showToast('Summary generated successfully! ✨');
        } catch (err) {
          if (summaryLoading) summaryLoading.classList.add('hidden');
          if (summaryEmptyState) summaryEmptyState.classList.remove('hidden');
          showError("Failed to generate summary. Please check your notes text.", err);
        }
      }, 650);
    });
  }

  /**
   * Renders the structured summary elements into the DOM.
   *
   * @param {{
   *   keyPoints: string[],
   *   terms: Array<{name: string, def: string}>,
   *   quickRevision: string
   * }} data - Extracted summary data.
   */
  function renderSummaryContent(data) {
    if (summaryKeyPoints) {
      summaryKeyPoints.innerHTML = data.keyPoints
        .map(pt => `<li>${escapeHtml(pt)}</li>`)
        .join('');
    }

    if (summaryTerms) {
      summaryTerms.innerHTML = data.terms
        .map(t => `
          <div class="term-card">
            <div class="term-name">${escapeHtml(t.name)}</div>
            <div class="term-def">${escapeHtml(t.def)}</div>
          </div>
        `).join('');
    }

    if (summaryRevision) {
      summaryRevision.innerHTML = `⚡ <strong>Quick Revision:</strong> ${escapeHtml(data.quickRevision)}`;
    }
  }

  if (copySummaryBtn && summaryKeyPoints && summaryTerms && summaryRevision) {
    copySummaryBtn.addEventListener('click', () => {
      try {
        const points = Array.from(summaryKeyPoints.querySelectorAll('li'))
          .map(li => "• " + li.innerText)
          .join('\n');

        const terms = Array.from(summaryTerms.querySelectorAll('.term-card'))
          .map(card => {
            const name = card.querySelector('.term-name')?.innerText || '';
            const def = card.querySelector('.term-def')?.innerText || '';
            return `${name}: ${def}`;
          }).join('\n');

        const revision = summaryRevision.innerText;
        const fullSummaryText = `SMART STUDY AI — STUDY SUMMARY\n\nKEY POINTS:\n${points}\n\nIMPORTANT TERMS:\n${terms}\n\n${revision}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullSummaryText)
            .then(() => showToast('Summary copied to clipboard! 📋'))
            .catch(() => showToast('Summary copied to clipboard! 📋'));
        } else {
          showToast('Summary copied! 📋');
        }
      } catch (err) {
        showError("Could not copy to clipboard.", err);
      }
    });
  }

  // ==========================================================================
  // 6. 5-QUESTION INTERACTIVE QUIZ ENGINE
  // ==========================================================================
  let quizQuestions = [...DEFAULT_QUIZ_DATA];
  let currentQuestionIndex = 0;
  let selectedOptionIndex = null;
  let userAnswers = [];

  const quizActiveCard = document.getElementById('quizActiveCard');
  const quizResultCard = document.getElementById('quizResultCard');
  const quizCategoryPill = document.getElementById('quizCategoryPill');
  const quizStepText = document.getElementById('quizStepText');
  const quizProgressFill = document.getElementById('quizProgressFill');
  const quizQuestionText = document.getElementById('quizQuestionText');
  const quizOptionsContainer = document.getElementById('quizOptionsContainer');
  const quizNextBtn = document.getElementById('quizNextBtn');
  const quizTip = document.getElementById('quizTip');

  const resultPercent = document.getElementById('resultPercent');
  const resultCorrectCount = document.getElementById('resultCorrectCount');
  const resultIncorrectCount = document.getElementById('resultIncorrectCount');
  const resultTotalScore = document.getElementById('resultTotalScore');
  const resultTitle = document.getElementById('resultTitle');
  const resultSubtitle = document.getElementById('resultSubtitle');
  const resultCelebration = document.getElementById('resultCelebration');
  const quizReviewList = document.getElementById('quizReviewList');
  const retryQuizBtn = document.getElementById('retryQuizBtn');
  const goToDashboardFromQuizBtn = document.getElementById('goToDashboardFromQuizBtn');

  /**
   * Loads quiz data asynchronously from data/quiz-data.json with defensive fallback
   * to DEFAULT_QUIZ_DATA when offline or running under strict file:// CORS policies.
   */
  async function loadQuizDataSafely() {
    try {
      const response = await fetch('data/quiz-data.json');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const jsonData = await response.json();
      const validation = validateQuizData(jsonData);

      if (validation.isValid && validation.validQuestions.length > 0) {
        quizQuestions = validation.validQuestions;
      } else {
        console.warn("[Quiz Validation Warning]: Fallback used due to data errors:", validation.errors);
        quizQuestions = [...DEFAULT_QUIZ_DATA];
      }
    } catch (fetchErr) {
      // Expected under file:// protocol without local server; fallback cleanly without throwing
      console.info("[Quiz Data Notice]: Loaded questions from built-in static dataset (offline-ready).");
      quizQuestions = [...DEFAULT_QUIZ_DATA];
    }

    renderCurrentQuizQuestion();
  }

  /**
   * Renders the current question and options into the quiz container.
   * Defensively handles out-of-range indices and malformed questions.
   */
  function renderCurrentQuizQuestion() {
    try {
      if (!Array.isArray(quizQuestions) || quizQuestions.length === 0) {
        if (quizQuestionText) {
          quizQuestionText.textContent = "No quiz questions available. Please try refreshing.";
        }
        return;
      }

      if (currentQuestionIndex < 0 || currentQuestionIndex >= quizQuestions.length) {
        currentQuestionIndex = 0;
      }

      const q = quizQuestions[currentQuestionIndex];
      selectedOptionIndex = null;

      if (quizCategoryPill) quizCategoryPill.textContent = q.category || "Science & Technology";
      if (quizStepText) quizStepText.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;

      const progressPercent = calculateProgressPercentage(currentQuestionIndex + 1, quizQuestions.length);
      if (quizProgressFill) quizProgressFill.style.width = `${progressPercent}%`;

      if (quizQuestionText) quizQuestionText.textContent = q.question;

      if (quizOptionsContainer) {
        quizOptionsContainer.innerHTML = '';
        const prefixLetters = ['A', 'B', 'C', 'D'];

        (q.options || []).forEach((optText, idx) => {
          const optionEl = document.createElement('div');
          optionEl.className = 'quiz-option';
          optionEl.setAttribute('data-index', String(idx));
          optionEl.innerHTML = `
            <div class="option-prefix">${prefixLetters[idx] || (idx + 1)}</div>
            <div class="option-text">${escapeHtml(optText)}</div>
          `;

          optionEl.addEventListener('click', () => {
            document.querySelectorAll('.quiz-option').forEach(el => el.classList.remove('selected'));
            optionEl.classList.add('selected');
            selectedOptionIndex = idx;
            if (quizNextBtn) quizNextBtn.disabled = false;
            if (quizTip) quizTip.textContent = "Answer selected. Click below to continue!";
          });

          quizOptionsContainer.appendChild(optionEl);
        });
      }

      if (quizNextBtn) {
        quizNextBtn.disabled = true;
        const isLast = currentQuestionIndex === quizQuestions.length - 1;
        const btnSpan = quizNextBtn.querySelector('span');
        if (btnSpan) btnSpan.textContent = isLast ? 'Finish Quiz' : 'Next Question';
      }

      if (quizTip) {
        quizTip.textContent = "Select an answer above to proceed";
      }
    } catch (err) {
      showError("Error displaying quiz question. Resetting to question 1.", err);
      currentQuestionIndex = 0;
    }
  }

  if (quizNextBtn) {
    quizNextBtn.addEventListener('click', () => {
      if (selectedOptionIndex === null) {
        showToast("Please select an option before moving to the next question.");
        return;
      }

      userAnswers[currentQuestionIndex] = selectedOptionIndex;

      if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        renderCurrentQuizQuestion();
      } else {
        showQuizResults();
      }
    });
  }

  /**
   * Calculates score using pure utility function, displays result screen,
   * updates localStorage, and renders detailed review breakdown.
   */
  function showQuizResults() {
    try {
      if (quizActiveCard) quizActiveCard.classList.add('hidden');
      if (quizResultCard) quizResultCard.classList.remove('hidden');

      const result = calculateQuizScore(userAnswers, quizQuestions);

      if (resultPercent) resultPercent.textContent = `${result.percentage}%`;
      if (resultCorrectCount) resultCorrectCount.textContent = String(result.correctCount);
      if (resultIncorrectCount) resultIncorrectCount.textContent = String(result.incorrectCount);
      if (resultTotalScore) resultTotalScore.textContent = `${result.score} / ${result.total}`;

      const scoreCircle = document.querySelector('.result-score-circle');
      if (scoreCircle) {
        scoreCircle.style.setProperty('--percent', String(result.percentage));
      }

      // Performance evaluation text
      if (result.percentage >= 80) {
        if (resultCelebration) resultCelebration.textContent = '🏆';
        if (resultTitle) resultTitle.textContent = 'Outstanding Mastery!';
        if (resultSubtitle) resultSubtitle.textContent = `You scored ${result.percentage}%! Excellent grasp of core study concepts.`;
      } else if (result.percentage >= 60) {
        if (resultCelebration) resultCelebration.textContent = '👍';
        if (resultTitle) resultTitle.textContent = 'Solid Performance!';
        if (resultSubtitle) resultSubtitle.textContent = `You scored ${result.percentage}%. A quick revision will push you into top marks!`;
      } else {
        if (resultCelebration) resultCelebration.textContent = '📚';
        if (resultTitle) resultTitle.textContent = 'Keep Practicing!';
        if (resultSubtitle) resultSubtitle.textContent = `You scored ${result.percentage}%. Review the answers below to reinforce memory.`;
      }

      // Render Answer Review List
      if (quizReviewList) {
        const prefix = ['A', 'B', 'C', 'D'];
        quizReviewList.innerHTML = quizQuestions.map((q, idx) => {
          const userChoice = userAnswers[idx];
          const isCorrect = userChoice === q.correctIndex;

          const userChoiceText = userChoice !== undefined && q.options[userChoice]
            ? `(${prefix[userChoice]}) ${escapeHtml(q.options[userChoice])}`
            : 'Unanswered';

          const correctChoiceText = `(${prefix[q.correctIndex]}) ${escapeHtml(q.options[q.correctIndex])}`;

          return `
            <div class="review-item ${isCorrect ? 'correct' : 'incorrect'}">
              <div class="review-q-title">Q${idx + 1}: ${escapeHtml(q.question)}</div>
              <div class="review-answer-line">
                Your Answer: <span class="${isCorrect ? 'ans-correct' : 'ans-wrong'}">
                  ${userChoiceText} ${isCorrect ? '✓' : '✕'}
                </span>
              </div>
              ${!isCorrect ? `
                <div class="review-answer-line">
                  Correct Answer: <span class="ans-correct">${correctChoiceText}</span>
                </div>
              ` : ''}
              <div class="review-answer-line text-muted" style="margin-top: 4px; font-size: 0.78rem;">
                💡 <em>${escapeHtml(q.explanation || '')}</em>
              </div>
            </div>
          `;
        }).join('');
      }

      // Persist new quiz score in localStorage
      userData.quizScore = result.percentage;
      userData.quizzesTaken = (userData.quizzesTaken || 0) + 1;
      persistUserData(userData);
      showToast(`Quiz completed! Score ${result.percentage}% saved to Dashboard 🎯`);
    } catch (err) {
      showError("Error compiling quiz results.", err);
    }
  }

  function resetQuiz() {
    currentQuestionIndex = 0;
    selectedOptionIndex = null;
    userAnswers = [];
    if (quizResultCard) quizResultCard.classList.add('hidden');
    if (quizActiveCard) quizActiveCard.classList.remove('hidden');
    renderCurrentQuizQuestion();
  }

  if (retryQuizBtn) retryQuizBtn.addEventListener('click', resetQuiz);
  if (goToDashboardFromQuizBtn) {
    goToDashboardFromQuizBtn.addEventListener('click', () => {
      switchTab('dashboard');
    });
  }

  // Load and initialize quiz questions safely
  loadQuizDataSafely();

  // ==========================================================================
  // 7. PROGRESS TAB ACTIONS & LOGGING
  // ==========================================================================
  const logStudyBtn = document.getElementById('logStudyBtn');
  if (logStudyBtn) {
    logStudyBtn.addEventListener('click', () => {
      try {
        userData.studyHours += 1;
        if (userData.topicsCompleted < userData.totalTopics) {
          userData.topicsCompleted += 1;
        }
        persistUserData(userData);
        showToast(`+1 Study Hour logged! Total: ${userData.studyHours}h ⏱️`);
      } catch (err) {
        showError("Failed to log study session.", err);
      }
    });
  }

  // ==========================================================================
  // 8. TOAST NOTIFICATION UTILITY
  // ==========================================================================

  /**
   * Displays a floating non-blocking toast notification.
   *
   * @param {string} message - Text notification.
   * @param {number} [duration=3200] - Duration in ms before fade-out.
   */
  function showToast(message, duration = 3200) {
    try {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    } catch (e) {
      console.warn("Could not display toast notification:", message);
    }
  }
});
