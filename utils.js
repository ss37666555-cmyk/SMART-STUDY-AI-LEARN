/**
 * SMART STUDY AI — CORE UTILITIES & ERROR BOUNDARIES
 * "Learn Smarter. Study Better."
 *
 * This module isolates pure domain logic, mathematical calculations,
 * data validation routines, and defensive error handlers.
 * It is designed to run universally in both modern browser environments
 * and headless Node.js testing environments without external dependencies.
 */

// ============================================================================
// 1. DEFAULT DATA SCHEMAS
// ============================================================================

/**
 * Immutable default student progress data structure.
 * Used for initial user state and graceful error fallback whenever
 * stored data is missing, corrupted, or invalid.
 *
 * @type {Readonly<{
 *   userName: string,
 *   streak: number,
 *   quizScore: number,
 *   topicsCompleted: number,
 *   totalTopics: number,
 *   studyHours: number,
 *   targetHours: number,
 *   quizzesTaken: number
 * }>}
 */
const DEFAULT_USER_DATA = Object.freeze({
  userName: "Alex Morgan",
  streak: 7,
  quizScore: 85,
  topicsCompleted: 12,
  totalTopics: 15,
  studyHours: 18,
  targetHours: 20,
  quizzesTaken: 4
});

/**
 * Fallback static quiz dataset used when external JSON fetching is unavailable
 * (e.g. strict browser file:// protocol restrictions or offline without a local server).
 */
const DEFAULT_QUIZ_DATA = Object.freeze([
  {
    id: 1,
    category: "Biology",
    question: "What is the primary organelle responsible for producing cellular energy (ATP) through aerobic respiration?",
    options: [
      "Ribosome",
      "Mitochondria",
      "Golgi Apparatus",
      "Endoplasmic Reticulum"
    ],
    correctIndex: 1,
    explanation: "Mitochondria are the powerhouse of the cell, generating the bulk of ATP via the Krebs cycle and oxidative phosphorylation."
  },
  {
    id: 2,
    category: "Physics",
    question: "According to Newton's Second Law of Motion, what is the exact mathematical relationship between Force (F), Mass (m), and Acceleration (a)?",
    options: [
      "F = m / a",
      "F = m × a",
      "F = m + a",
      "F = a / m"
    ],
    correctIndex: 1,
    explanation: "Newton's Second Law states that Force is the product of mass and acceleration (F = ma)."
  },
  {
    id: 3,
    category: "Computer Science",
    question: "What is the average and worst-case time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
    options: [
      "O(1)",
      "O(n²)",
      "O(log n)",
      "O(n log n)"
    ],
    correctIndex: 2,
    explanation: "In a balanced BST, each comparison cuts the search space in half, yielding O(log n) search time."
  },
  {
    id: 4,
    category: "Chemistry",
    question: "Which gas is primarily fixed and converted into carbohydrates during the light-independent reactions of photosynthesis?",
    options: [
      "Oxygen (O₂)",
      "Nitrogen (N₂)",
      "Carbon Dioxide (CO₂)",
      "Methane (CH₄)"
    ],
    correctIndex: 2,
    explanation: "Carbon dioxide (CO₂) is fixed by the enzyme RuBisCO during the Calvin cycle to produce glucose."
  },
  {
    id: 5,
    category: "Study Methodology",
    question: "Which scientifically backed study technique involves reviewing material across expanding intervals of time to optimize memory retention?",
    options: [
      "Spaced Repetition",
      "Massed Cramming",
      "Passive Highlighting",
      "Continuous Rereading"
    ],
    correctIndex: 0,
    explanation: "Spaced repetition combats the Ebbinghaus Forgetting Curve by scheduling reviews right as memories begin to fade."
  }
]);

// ============================================================================
// 2. DATA VALIDATION & SANITIZATION
// ============================================================================

/**
 * Validates and sanitizes student progress data.
 * Checks for presence, types, finite numbers, and logical boundaries.
 *
 * @param {unknown} data - Raw candidate user data object to validate.
 * @returns {{
 *   isValid: boolean,
 *   sanitizedData: typeof DEFAULT_USER_DATA,
 *   errors: string[]
 * }} Validation summary, sanitized object, and any identified validation errors.
 */
function validateUserData(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      sanitizedData: { ...DEFAULT_USER_DATA },
      errors: ["Input data must be a non-null object."]
    };
  }

  const raw = /** @type {Record<string, unknown>} */ (data);

  // Validate userName
  let userName = DEFAULT_USER_DATA.userName;
  if (typeof raw.userName === 'string' && raw.userName.trim().length > 0) {
    userName = raw.userName.trim().slice(0, 100);
  } else if (raw.userName !== undefined) {
    errors.push("userName must be a non-empty string.");
  }

  // Helper for positive bounded integers
  const sanitizeInt = (val, fieldName, defaultVal, min = 0, max = 100000) => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max) {
      return Math.round(val);
    }
    if (val !== undefined) {
      errors.push(`${fieldName} must be a number between ${min} and ${max}.`);
    }
    return defaultVal;
  };

  const streak = sanitizeInt(raw.streak, 'streak', DEFAULT_USER_DATA.streak, 0, 3650);
  const quizScore = sanitizeInt(raw.quizScore, 'quizScore', DEFAULT_USER_DATA.quizScore, 0, 100);
  const totalTopics = sanitizeInt(raw.totalTopics, 'totalTopics', DEFAULT_USER_DATA.totalTopics, 1, 1000);
  const topicsCompleted = Math.min(
    totalTopics,
    sanitizeInt(raw.topicsCompleted, 'topicsCompleted', DEFAULT_USER_DATA.topicsCompleted, 0, totalTopics)
  );

  const studyHours = sanitizeInt(raw.studyHours, 'studyHours', DEFAULT_USER_DATA.studyHours, 0, 10000);
  const targetHours = sanitizeInt(raw.targetHours, 'targetHours', DEFAULT_USER_DATA.targetHours, 1, 10000);
  const quizzesTaken = sanitizeInt(raw.quizzesTaken, 'quizzesTaken', DEFAULT_USER_DATA.quizzesTaken, 0, 100000);

  const sanitizedData = {
    userName,
    streak,
    quizScore,
    topicsCompleted,
    totalTopics,
    studyHours,
    targetHours,
    quizzesTaken
  };

  return {
    isValid: errors.length === 0,
    sanitizedData,
    errors
  };
}

// ============================================================================
// 3. STORAGE & DEFENSIVE ERROR BOUNDARIES
// ============================================================================

/**
 * Safely loads student progress data from storage.
 * Handles missing storage, disabled cookies/storage, corrupted JSON,
 * and invalid schemas, falling back gracefully to defaults.
 *
 * @param {Storage|{getItem: Function}|null} [storage] - Storage provider (defaults to window.localStorage).
 * @param {string} [storageKey='smartStudyAI_data'] - Key name in storage.
 * @returns {{
 *   data: typeof DEFAULT_USER_DATA,
 *   wasRestoredFromDefault: boolean,
 *   errorMessage: string|null
 * }} The sanitized data and status report.
 */
function safeLoadData(storage, storageKey = 'smartStudyAI_data') {
  const store = storage || (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

  if (!store) {
    return {
      data: { ...DEFAULT_USER_DATA },
      wasRestoredFromDefault: true,
      errorMessage: "Storage API is unavailable in this environment."
    };
  }

  try {
    const rawItem = store.getItem(storageKey);
    if (!rawItem) {
      return {
        data: { ...DEFAULT_USER_DATA },
        wasRestoredFromDefault: false,
        errorMessage: null
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawItem);
    } catch (parseError) {
      return {
        data: { ...DEFAULT_USER_DATA },
        wasRestoredFromDefault: true,
        errorMessage: "Stored data contained corrupted JSON. Restored default state."
      };
    }

    const { isValid, sanitizedData, errors } = validateUserData(parsed);
    if (!isValid) {
      return {
        data: sanitizedData,
        wasRestoredFromDefault: true,
        errorMessage: `Stored data had invalid fields: ${errors.join(' ')} Restored clean state.`
      };
    }

    return {
      data: sanitizedData,
      wasRestoredFromDefault: false,
      errorMessage: null
    };
  } catch (accessError) {
    return {
      data: { ...DEFAULT_USER_DATA },
      wasRestoredFromDefault: true,
      errorMessage: "Security or access error occurred while accessing storage."
    };
  }
}

/**
 * Safely persists student progress data to storage with validation and quota defense.
 *
 * @param {unknown} candidateData - User data object to validate and store.
 * @param {Storage|{setItem: Function}|null} [storage] - Storage provider (defaults to window.localStorage).
 * @param {string} [storageKey='smartStudyAI_data'] - Storage key name.
 * @returns {{
 *   success: boolean,
 *   sanitizedData: typeof DEFAULT_USER_DATA,
 *   error: string|null
 * }} Persistence result and error status.
 */
function safeSaveData(candidateData, storage, storageKey = 'smartStudyAI_data') {
  const store = storage || (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

  const { sanitizedData } = validateUserData(candidateData);

  if (!store) {
    return {
      success: false,
      sanitizedData,
      error: "Storage API is unavailable. Changes kept in memory only."
    };
  }

  try {
    const serialized = JSON.stringify(sanitizedData);
    store.setItem(storageKey, serialized);
    return {
      success: true,
      sanitizedData,
      error: null
    };
  } catch (writeError) {
    const isQuota = writeError && typeof writeError === 'object' && 'name' in writeError &&
      (writeError.name === 'QuotaExceededError' || writeError.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    const errorMsg = isQuota
      ? "Storage quota exceeded. Unable to save latest changes."
      : "Unable to write data to browser storage.";

    return {
      success: false,
      sanitizedData,
      error: errorMsg
    };
  }
}

// ============================================================================
// 4. QUIZ LOGIC & VALIDATION
// ============================================================================

/**
 * Validates a single quiz question object for structure, types, and logical bounds.
 *
 * @param {unknown} q - Question candidate object.
 * @param {number} [index=0] - 0-indexed position for error reporting.
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateQuizQuestion(q, index = 0) {
  const errors = [];
  if (!q || typeof q !== 'object') {
    return { isValid: false, errors: [`Question at index ${index} must be an object.`] };
  }

  const raw = /** @type {Record<string, unknown>} */ (q);

  if (typeof raw.question !== 'string' || raw.question.trim().length === 0) {
    errors.push(`Question at index ${index} is missing a valid 'question' text string.`);
  }

  if (!Array.isArray(raw.options) || raw.options.length < 2) {
    errors.push(`Question at index ${index} must have an 'options' array with at least 2 choices.`);
  } else {
    raw.options.forEach((opt, optIdx) => {
      if (typeof opt !== 'string' || opt.trim().length === 0) {
        errors.push(`Question at index ${index} option ${optIdx} must be a non-empty string.`);
      }
    });
  }

  const numOptions = Array.isArray(raw.options) ? raw.options.length : 0;
  if (
    typeof raw.correctIndex !== 'number' ||
    !Number.isInteger(raw.correctIndex) ||
    raw.correctIndex < 0 ||
    (numOptions > 0 && raw.correctIndex >= numOptions)
  ) {
    errors.push(`Question at index ${index} has an invalid 'correctIndex' (${raw.correctIndex}). Must be between 0 and ${numOptions - 1}.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates an entire array of quiz questions.
 *
 * @param {unknown} quizData - Array of questions.
 * @returns {{
 *   isValid: boolean,
 *   validQuestions: Array<typeof DEFAULT_QUIZ_DATA[0]>,
 *   errors: string[]
 * }}
 */
function validateQuizData(quizData) {
  const errors = [];
  if (!Array.isArray(quizData) || quizData.length === 0) {
    return {
      isValid: false,
      validQuestions: [],
      errors: ["Quiz dataset must be a non-empty array of questions."]
    };
  }

  const validQuestions = [];
  quizData.forEach((q, idx) => {
    const result = validateQuizQuestion(q, idx);
    if (!result.isValid) {
      errors.push(...result.errors);
    } else {
      validQuestions.push(/** @type {typeof DEFAULT_QUIZ_DATA[0]} */ (q));
    }
  });

  return {
    isValid: errors.length === 0,
    validQuestions,
    errors
  };
}

/**
 * Calculates quiz score, percentage, correct/incorrect counters, and review details.
 * Pure mathematical function with zero side-effects and robust boundary handling.
 *
 * Handles key test cases:
 * - 5/5 = 100%
 * - 4/5 = 80%
 * - 2/5 = 40%
 * - 0/5 = 0%
 *
 * @param {Array<number|null|undefined>} userAnswers - Array of user selected option indices.
 * @param {Array<{correctIndex: number}>} questions - Array of questions with correctIndex property.
 * @returns {{
 *   score: number,
 *   total: number,
 *   percentage: number,
 *   correctCount: number,
 *   incorrectCount: number
 * }}
 */
function calculateQuizScore(userAnswers, questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      score: 0,
      total: 0,
      percentage: 0,
      correctCount: 0,
      incorrectCount: 0
    };
  }

  const safeAnswers = Array.isArray(userAnswers) ? userAnswers : [];
  let correctCount = 0;

  questions.forEach((q, idx) => {
    const selected = safeAnswers[idx];
    if (
      typeof selected === 'number' &&
      Number.isInteger(selected) &&
      q &&
      typeof q.correctIndex === 'number' &&
      selected === q.correctIndex
    ) {
      correctCount++;
    }
  });

  const total = questions.length;
  const incorrectCount = total - correctCount;
  const percentage = Math.round((correctCount / total) * 100);

  return {
    score: correctCount,
    total,
    percentage,
    correctCount,
    incorrectCount
  };
}

// ============================================================================
// 5. PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calculates progress percentage safely between a current value and a target.
 *
 * Rules:
 * - Negative inputs return 0%
 * - Target <= 0 returns 0% (prevents division by zero)
 * - Non-numeric or NaN inputs return 0%
 * - Capped at 100% for standard progress bars, but also reports raw uncapped percentage
 *
 * Examples:
 * - 12 completed / 15 target = 80%
 * - 18 hours / 20 target = 90%
 * - 0 / 15 = 0%
 * - 25 / 20 = 100% (raw 125%)
 *
 * @param {unknown} current - Current progress value.
 * @param {unknown} target - Target goal value.
 * @param {boolean} [capAt100=true] - Whether to cap the return value at 100%.
 * @returns {number} Integer percentage (0 - 100, or higher if capAt100 is false).
 */
function calculateProgressPercentage(current, target, capAt100 = true) {
  const curNum = typeof current === 'number' ? current : Number(current);
  const tgtNum = typeof target === 'number' ? target : Number(target);

  if (!Number.isFinite(curNum) || !Number.isFinite(tgtNum)) {
    return 0;
  }

  if (curNum <= 0 || tgtNum <= 0) {
    return 0;
  }

  const rawPercent = Math.round((curNum / tgtNum) * 100);

  if (capAt100) {
    return Math.min(100, Math.max(0, rawPercent));
  }

  return Math.max(0, rawPercent);
}

// ============================================================================
// 6. NOTES SUMMARIZER VALIDATION & PROCESSING
// ============================================================================

/**
 * Validates candidate note text before processing.
 *
 * @param {unknown} text - Notes text to validate.
 * @param {number} [maxChars=50000] - Upper boundary on character count.
 * @returns {{
 *   isValid: boolean,
 *   sanitizedText: string,
 *   error: string|null
 * }}
 */
function validateNotesInput(text, maxChars = 50000) {
  if (typeof text !== 'string') {
    return {
      isValid: false,
      sanitizedText: '',
      error: "Notes input must be text."
    };
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      sanitizedText: '',
      error: "Please enter or paste study notes before generating a summary."
    };
  }

  if (trimmed.length > maxChars) {
    return {
      isValid: false,
      sanitizedText: trimmed.slice(0, maxChars),
      error: `Notes exceed the maximum limit of ${maxChars.toLocaleString()} characters. Please condense your excerpt.`
    };
  }

  // Check for minimum meaningful content (at least 15 alphanumeric characters)
  const alphaCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphaCount < 15) {
    return {
      isValid: false,
      sanitizedText: trimmed,
      error: "Notes are too brief or contain insufficient text to generate a meaningful study summary."
    };
  }

  return {
    isValid: true,
    sanitizedText: trimmed,
    error: null
  };
}

/**
 * Processes valid raw note text into structured study takeaways:
 * Key Points, Important Terms, and a Quick Revision summary.
 *
 * @param {string} rawText - Validated notes input.
 * @returns {{
 *   keyPoints: string[],
 *   terms: Array<{name: string, def: string}>,
 *   quickRevision: string
 * }}
 */
function processNotesSummary(rawText) {
  const textLower = (rawText || '').toLowerCase();

  // Domain-specific extraction for biology & respiration
  if (
    textLower.includes('respiration') ||
    textLower.includes('atp') ||
    textLower.includes('mitochondria') ||
    textLower.includes('glucose')
  ) {
    return {
      keyPoints: [
        "Three Main Stages: Cellular respiration proceeds sequentially through Glycolysis (cytosol), Krebs Cycle (mitochondrial matrix), and Oxidative Phosphorylation (inner cristae).",
        "ATP Energy Yield: Aerobic respiration achieves a high net yield of roughly 30–32 ATP molecules per oxidized glucose molecule.",
        "Electron Carriers: NADH and FADH₂ transfer reducing equivalents to the Electron Transport Chain to establish a proton gradient.",
        "Terminal Electron Acceptor: Molecular oxygen (O₂) acts as the final acceptor, binding with H⁺ ions to form water (H₂O)."
      ],
      terms: [
        {
          name: "Adenosine Triphosphate (ATP)",
          def: "The primary high-energy chemical currency used by all living cells to drive physiological work."
        },
        {
          name: "ATP Synthase",
          def: "A rotary molecular engine enzyme that utilizes the proton electrochemical gradient to phosphorylate ADP into ATP."
        },
        {
          name: "Glycolysis",
          def: "The anaerobic enzymatic breakdown of 1 glucose molecule into 2 pyruvates in the cytoplasm, yielding net 2 ATP."
        }
      ],
      quickRevision: "Remember Cytoplasm ➔ Matrix ➔ Cristae. Glycolysis needs NO oxygen (net 2 ATP). Krebs cycle releases CO₂ and fills NADH batteries. ETC uses oxygen as final electron sponge to produce ~30-32 ATP via proton-motive force."
    };
  }

  // Domain-specific extraction for photosynthesis
  if (textLower.includes('photosynthesis') || textLower.includes('chloroplast') || textLower.includes('chlorophyll')) {
    return {
      keyPoints: [
        "Energy Conversion: Converts radiant solar energy into chemical energy stored within glucose bonds.",
        "Two Core Phases: Light reactions in thylakoid membranes split water (producing O₂); Calvin cycle in stroma fixes CO₂.",
        "Pigment Absorption: Chlorophyll pigments absorb blue and red wavelengths while reflecting green light.",
        "Overall Reaction: 6CO₂ + 6H₂O + Light Energy ➔ C₆H₁₂O₆ + 6O₂."
      ],
      terms: [
        {
          name: "Chloroplast",
          def: "Double-membraned plant organelle where photosynthesis reactions take place."
        },
        {
          name: "Calvin Cycle",
          def: "Light-independent enzymatic reactions that synthesize sugars from carbon dioxide."
        },
        {
          name: "Thylakoid",
          def: "Membrane-bound compartments inside chloroplasts where light-dependent reactions occur."
        }
      ],
      quickRevision: "Sunlight + Water + CO₂ ➔ Sugar + Oxygen. Light reactions happen in thylakoids; sugar synthesis happens in the stroma."
    };
  }

  // Generic intelligent parser for custom notes
  const sentences = (rawText || '')
    .replace(/\n+/g, ' ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const keyPoints = sentences.slice(0, 4);
  if (keyPoints.length === 0) {
    keyPoints.push("Key concept extracted from your study notes draft.");
  }

  // Extract capitalized words as potential key terms
  const potentialTerms = rawText.match(/[A-Z][a-z]{3,}/g) || ["Core Concept", "Key Factor", "Important Principle"];
  const uniqueTerms = Array.from(new Set(potentialTerms)).slice(0, 3);

  const terms = uniqueTerms.map(term => ({
    name: term,
    def: "Significant concept extracted from your notes. Review definitions and related formulas before exams."
  }));

  const quickRevision = `Focus on understanding the primary relationship between ${uniqueTerms.join(' & ')}. Create flashcards for the extracted terms and practice explaining them aloud.`;

  return {
    keyPoints,
    terms,
    quickRevision
  };
}

// ============================================================================
// 7. AI TUTOR VALIDATION & RESPONSE ENGINE
// ============================================================================

/**
 * Validates user question input for the AI tutor.
 *
 * @param {unknown} query - User question string.
 * @param {number} [maxChars=1000] - Upper character limit.
 * @returns {{
 *   isValid: boolean,
 *   sanitizedQuery: string,
 *   error: string|null
 * }}
 */
function validateTutorQuery(query, maxChars = 1000) {
  if (typeof query !== 'string') {
    return {
      isValid: false,
      sanitizedQuery: '',
      error: "Question must be a valid text string."
    };
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      sanitizedQuery: '',
      error: "Please enter a question or select a quick study prompt."
    };
  }

  if (trimmed.length > maxChars) {
    return {
      isValid: false,
      sanitizedQuery: trimmed.slice(0, maxChars),
      error: `Question exceeds limit of ${maxChars} characters. Please shorten your query.`
    };
  }

  return {
    isValid: true,
    sanitizedQuery: trimmed,
    error: null
  };
}

/**
 * Generates structured study response for the AI tutor interface.
 *
 * @param {string} query - Validated user question.
 * @returns {{ topic: string, content: string }}
 */
function generateTutorResponse(query) {
  const q = (query || '').toLowerCase();

  if (q.includes('photosynthesis') || q.includes('chloroplast') || q.includes('plants')) {
    if (q.includes('simply') || q.includes('simple') || q.includes('eli5')) {
      return {
        topic: "Photosynthesis",
        content: "<p>Photosynthesis is the process by which green plants make their food using sunlight, water and carbon dioxide.</p>"
      };
    }
    return {
      topic: "Photosynthesis",
      content: `<p><strong>Photosynthesis</strong> is the biological process by which green plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose.</p>
      <p>The chemical formula is:<br><code>6CO₂ + 6H₂O + Light Energy ➔ C₆H₁₂O₆ + 6O₂</code></p>
      <ul>
        <li><strong>Light Reactions (Thylakoids):</strong> Sunlight splits water, producing ATP and releasing Oxygen.</li>
        <li><strong>Calvin Cycle (Stroma):</strong> Carbon dioxide is fixed into high-energy sugars (glucose).</li>
      </ul>
      <p><strong>💡 Key Takeaway:</strong> Chlorophyll pigments in chloroplasts absorb blue & red light, giving plants their green appearance.</p>`
    };
  }

  if (q.includes('newton') || q.includes('motion') || q.includes('f=ma') || q.includes('inertia')) {
    if (q.includes('simply') || q.includes('simple')) {
      return {
        topic: "Newton's Laws of Motion",
        content: "<p>Newton's laws explain how objects move: 1) Objects keep doing what they're doing unless pushed, 2) Force equals mass times acceleration (F=ma), 3) Every action has an equal and opposite reaction.</p>"
      };
    }
    return {
      topic: "Newton's Laws of Motion",
      content: `<p>Sir Isaac Newton formulated three foundational laws describing classical mechanics:</p>
      <ul>
        <li><strong>First Law (Law of Inertia):</strong> An object at rest stays at rest, and an object in motion continues with constant velocity unless acted upon by a net external force.</li>
        <li><strong>Second Law (F = m × a):</strong> Acceleration is directly proportional to net force and inversely proportional to mass.</li>
        <li><strong>Third Law (Action & Reaction):</strong> For every action force, there is an equal and opposite reaction force.</li>
      </ul>
      <p><strong>💡 Key Takeaway:</strong> These principles govern everything from rocket launches to vehicle safety belts.</p>`
    };
  }

  if (q.includes('mitosis') || q.includes('meiosis') || q.includes('cell division')) {
    if (q.includes('simply') || q.includes('simple')) {
      return {
        topic: "Mitosis vs Meiosis",
        content: "<p>Mitosis creates 2 identical body cells for growth and repair. Meiosis creates 4 unique sex cells (sperm/egg) with half the chromosomes for reproduction.</p>"
      };
    }
    return {
      topic: "Mitosis vs Meiosis",
      content: `<p><strong>Cell Division Comparison:</strong></p>
      <ul>
        <li><strong>Mitosis:</strong> 1 cell division resulting in 2 genetically identical diploid (2n) daughter cells. Essential for somatic tissue repair and organism growth.</li>
        <li><strong>Meiosis:</strong> 2 sequential cell divisions resulting in 4 genetically unique haploid (1n) gametes. Involves crossing over (genetic recombination).</li>
      </ul>
      <p><strong>💡 Key Takeaway:</strong> Mitosis clones cells; Meiosis introduces genetic diversity.</p>`
    };
  }

  if (q.includes('big-o') || q.includes('big o') || q.includes('time complexity') || q.includes('algorithm')) {
    if (q.includes('simply') || q.includes('simple')) {
      return {
        topic: "Big-O Notation",
        content: "<p>Big-O notation measures how the runtime or memory of an algorithm grows as the input size (n) becomes very large.</p>"
      };
    }
    return {
      topic: "Big-O Notation",
      content: `<p><strong>Big-O Notation</strong> describes the upper bound of an algorithm's time or space complexity:</p>
      <ul>
        <li><code>O(1)</code> — Constant time (e.g. direct array indexing).</li>
        <li><code>O(log n)</code> — Logarithmic time (e.g. binary search).</li>
        <li><code>O(n)</code> — Linear time (e.g. iterating through a list).</li>
        <li><code>O(n²)</code> — Quadratic time (e.g. nested bubble sort).</li>
      </ul>
      <p><strong>💡 Key Takeaway:</strong> Prioritize algorithms with smaller growth rates when handling large datasets.</p>`
    };
  }

  // Safe fallback for custom student queries
  const safeSubject = escapeHtml(query.replace(/[?.,!]/g, '').trim()) || "Study Concept";

  return {
    topic: safeSubject,
    content: `<p>Great study question regarding <strong>"${safeSubject}"</strong>!</p>
    <p>Here is a structured academic breakdown:</p>
    <ul>
      <li><strong>Core Principle:</strong> This concept forms an essential pillar of your syllabus. It focuses on systematic problem-solving and fundamental relationships.</li>
      <li><strong>High-Yield Exam Focus:</strong> Ensure you can state core definitions, recall key governing formulas, and analyze edge-case applications.</li>
      <li><strong>Revision Strategy:</strong> Break multi-step problems down into smaller components and test yourself using active recall.</li>
    </ul>
    <p>Would you like an ultra-simple breakdown or a real-world example?</p>`
  };
}

// ============================================================================
// 8. HTML ESCAPING UTILITY
// ============================================================================

/**
 * Escapes special characters to prevent cross-site scripting (XSS).
 *
 * @param {string} str - Raw input string.
 * @returns {string} Sanitized HTML-safe string.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 9. MODULE EXPORTS (UNIVERSAL BROWSER + NODE COMPATIBILITY)
// ============================================================================

const SmartStudyUtils = {
  DEFAULT_USER_DATA,
  DEFAULT_QUIZ_DATA,
  validateUserData,
  safeLoadData,
  safeSaveData,
  validateQuizQuestion,
  validateQuizData,
  calculateQuizScore,
  calculateProgressPercentage,
  validateNotesInput,
  processNotesSummary,
  validateTutorQuery,
  generateTutorResponse,
  escapeHtml
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartStudyUtils;
}

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.SmartStudyUtils = SmartStudyUtils;
}
