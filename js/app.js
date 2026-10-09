/**
 * Chat Summarizer - Application Controller
 * Handles UI interactions, file ingestion via native File API,
 * parsing synchronization, LLM communication, results presentation,
 * live model discovery, and ground-truth source verification.
 */

(function () {
  'use strict';

  // Global State
  let currentRawText = '';
  let currentFileName = '';
  let parsedChat = null;
  let slicedData = null;
  let lastAnalysisResult = null;
  let selectedSummaryText = '';

  // DOM Elements Cache
  const DOM = {
    // Navigation & Settings
    btnToggleSettings: document.getElementById('btnToggleSettings'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    settingsSection: document.getElementById('settingsSection'),
    apiKeyStatusDot: document.getElementById('apiKeyStatusDot'),
    inputApiKey: document.getElementById('inputApiKey'),
    btnToggleApiKeyVisibility: document.getElementById('btnToggleApiKeyVisibility'),
    eyeIcon: document.getElementById('eyeIcon'),
    btnClearApiKey: document.getElementById('btnClearApiKey'),
    selectModel: document.getElementById('selectModel'),
    btnFetchLiveModels: document.getElementById('btnFetchLiveModels'),
    fetchModelsIcon: document.getElementById('fetchModelsIcon'),
    fetchModelsLabel: document.getElementById('fetchModelsLabel'),
    customModelBox: document.getElementById('customModelBox'),
    inputCustomModel: document.getElementById('inputCustomModel'),
    selectWordLimit: document.getElementById('selectWordLimit'),
    labelWordLimitVal: document.getElementById('labelWordLimitVal'),
    inputEndpoint: document.getElementById('inputEndpoint'),
    btnResetEndpoint: document.getElementById('btnResetEndpoint'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    saveNotice: document.getElementById('saveNotice'),
    btnTrySample: document.getElementById('btnTrySample'),

    // File Ingestion
    uploadSection: document.getElementById('uploadSection'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),

    // Inspector
    chatInspectorSection: document.getElementById('chatInspectorSection'),
    inspectorFileName: document.getElementById('inspectorFileName'),
    inspectorDateSpan: document.getElementById('inspectorDateSpan'),
    statTotalMessages: document.getElementById('statTotalMessages'),
    statParticipantsCount: document.getElementById('statParticipantsCount'),
    statTotalWords: document.getElementById('statTotalWords'),
    statSlicedWords: document.getElementById('statSlicedWords'),
    slicingAlertBanner: document.getElementById('slicingAlertBanner'),
    slicingAlertText: document.getElementById('slicingAlertText'),
    btnAdjustBudget: document.getElementById('btnAdjustBudget'),
    inspectorParticipantsList: document.getElementById('inspectorParticipantsList'),
    rawTranscriptPreview: document.getElementById('rawTranscriptPreview'),
    btnClearChat: document.getElementById('btnClearChat'),
    btnTriggerSummarize: document.getElementById('btnTriggerSummarize'),
    btnInstantDemoSummarize: document.getElementById('btnInstantDemoSummarize'),

    // Loading State
    loadingSection: document.getElementById('loadingSection'),
    loadingStatusText: document.getElementById('loadingStatusText'),
    loadingProgressBar: document.getElementById('loadingProgressBar'),

    // Error State
    errorSection: document.getElementById('errorSection'),
    errorMessageText: document.getElementById('errorMessageText'),
    btnSwitchToLlama33: document.getElementById('btnSwitchToLlama33'),
    btnOpenSettingsFromError: document.getElementById('btnOpenSettingsFromError'),
    btnInstantDemoFromError: document.getElementById('btnInstantDemoFromError'),
    btnRetrySummarize: document.getElementById('btnRetrySummarize'),

    // Results Dashboard
    resultsSection: document.getElementById('resultsSection'),
    resultChatTitle: document.getElementById('resultChatTitle'),
    resultToneBadge: document.getElementById('resultToneBadge'),
    resultModelBadge: document.getElementById('resultModelBadge'),
    resultTimeframe: document.getElementById('resultTimeframe'),
    btnOpenTranscriptModal: document.getElementById('btnOpenTranscriptModal'),
    btnCopyMarkdown: document.getElementById('btnCopyMarkdown'),
    copyMarkdownLabel: document.getElementById('copyMarkdownLabel'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnPrintReport: document.getElementById('btnPrintReport'),
    btnSummarizeNew: document.getElementById('btnSummarizeNew'),
    resultHighLevelSummary: document.getElementById('resultHighLevelSummary'),
    resultDecisionsList: document.getElementById('resultDecisionsList'),
    decisionCountBadge: document.getElementById('decisionCountBadge'),
    resultActionItemsList: document.getElementById('resultActionItemsList'),
    actionItemsCountBadge: document.getElementById('actionItemsCountBadge'),
    resultMentionsList: document.getElementById('resultMentionsList'),
    mentionsCountBadge: document.getElementById('mentionsCountBadge'),
    resultDeadlinesList: document.getElementById('resultDeadlinesList'),
    deadlinesCountBadge: document.getElementById('deadlinesCountBadge'),
    resultParticipantsBreakdown: document.getElementById('resultParticipantsBreakdown'),

    // Transcript & Source Verifier Modal
    transcriptModal: document.getElementById('transcriptModal'),
    btnCloseTranscriptModal: document.getElementById('btnCloseTranscriptModal'),
    btnFooterCloseTranscriptModal: document.getElementById('btnFooterCloseTranscriptModal'),
    modalActiveFileBadge: document.getElementById('modalActiveFileBadge'),
    inputTranscriptSearch: document.getElementById('inputTranscriptSearch'),
    btnClearTranscriptSearch: document.getElementById('btnClearTranscriptSearch'),
    selectTranscriptParticipant: document.getElementById('selectTranscriptParticipant'),
    transcriptMatchCounter: document.getElementById('transcriptMatchCounter'),
    transcriptMessagesContainer: document.getElementById('transcriptMessagesContainer'),
    floatingVerifyPill: document.getElementById('floatingVerifyPill')
  };

  /**
   * Initializes application state and event handlers
   */
  function init() {
    loadStoredSettings();
    attachEventListeners();
    refreshLucideIcons();
  }

  /**
   * Refreshes Lucide icons in the DOM
   */
  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /**
   * Loads settings from localStorage into the UI
   */
  function loadStoredSettings() {
    const settings = window.LLMClient.getSettings();

    if (DOM.inputApiKey) DOM.inputApiKey.value = settings.apiKey;
    if (DOM.inputEndpoint) DOM.inputEndpoint.value = settings.endpoint;
    if (DOM.selectWordLimit) DOM.selectWordLimit.value = settings.maxWords.toString();

    // Match or set model selection
    const storedModel = settings.model || 'llama-3.3-70b-versatile';
    if (DOM.selectModel) {
      let found = false;
      for (let i = 0; i < DOM.selectModel.options.length; i++) {
        if (DOM.selectModel.options[i].value === storedModel) {
          DOM.selectModel.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        DOM.selectModel.value = 'custom_model';
        if (DOM.customModelBox) DOM.customModelBox.classList.remove('hidden');
        if (DOM.inputCustomModel) DOM.inputCustomModel.value = storedModel;
      }
    }

    updateWordLimitLabel(settings.maxWords);
    updateApiKeyStatus(settings.apiKey);
  }

  /**
   * Updates visual indicator for API Key presence
   */
  function updateApiKeyStatus(apiKey) {
    const hasKey = Boolean(apiKey && apiKey.trim().length > 0);
    if (DOM.apiKeyStatusDot) {
      if (hasKey) {
        DOM.apiKeyStatusDot.classList.remove('bg-rose-500');
        DOM.apiKeyStatusDot.classList.add('bg-emerald-400');
      } else {
        DOM.apiKeyStatusDot.classList.remove('bg-emerald-400');
        DOM.apiKeyStatusDot.classList.add('bg-rose-500');
      }
    }
  }

  /**
   * Updates word limit text badge
   */
  function updateWordLimitLabel(limit) {
    if (!DOM.labelWordLimitVal) return;
    if (limit >= 900000) {
      DOM.labelWordLimitVal.textContent = 'Full chat (unlimited)';
    } else {
      DOM.labelWordLimitVal.textContent = `${Number(limit).toLocaleString()} words`;
    }
  }

  /**
   * Attaches event listeners across the application
   */
  function attachEventListeners() {
    // Settings toggles
    DOM.btnToggleSettings.addEventListener('click', toggleSettingsPanel);
    DOM.btnCloseSettings.addEventListener('click', toggleSettingsPanel);

    // Save Settings
    DOM.btnSaveSettings.addEventListener('click', saveCurrentSettings);

    // Live Models Fetcher
    if (DOM.btnFetchLiveModels) {
      DOM.btnFetchLiveModels.addEventListener('click', handleFetchLiveModels);
    }

    // Model selection change
    if (DOM.selectModel) {
      DOM.selectModel.addEventListener('change', () => {
        if (DOM.selectModel.value === 'custom_model') {
          if (DOM.customModelBox) DOM.customModelBox.classList.remove('hidden');
          if (DOM.inputCustomModel) DOM.inputCustomModel.focus();
        } else {
          if (DOM.customModelBox) DOM.customModelBox.classList.add('hidden');
        }
        saveCurrentSettings();
      });
    }

    if (DOM.inputCustomModel) {
      DOM.inputCustomModel.addEventListener('input', () => {
        saveCurrentSettings();
      });
    }

    // Word limit selection change
    DOM.selectWordLimit.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      updateWordLimitLabel(val);
      saveCurrentSettings();
      if (parsedChat) {
        recalculateSlicing();
      }
    });

    // Reset Endpoint
    DOM.btnResetEndpoint.addEventListener('click', () => {
      DOM.inputEndpoint.value = window.LLMClient.DEFAULT_CONFIG.endpoint;
    });

    // Toggle API Key visibility
    DOM.btnToggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = DOM.inputApiKey.type === 'password';
      DOM.inputApiKey.type = isPassword ? 'text' : 'password';
      DOM.eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
      refreshLucideIcons();
    });

    // Clear API Key
    DOM.btnClearApiKey.addEventListener('click', () => {
      if (confirm('Clear your saved Groq API key from this browser?')) {
        DOM.inputApiKey.value = '';
        window.LLMClient.clearApiKey();
        updateApiKeyStatus('');
        showSaveNotice('API key cleared');
      }
    });

    // File Drag & Drop events
    DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFileInputChange);

    DOM.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.dropZone.classList.add('drag-over');
    });

    DOM.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      DOM.dropZone.classList.remove('drag-over');
    });

    DOM.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    // Sample Chat loader
    DOM.btnTrySample.addEventListener('click', loadSampleChatData);

    // Inspector Actions
    DOM.btnClearChat.addEventListener('click', resetChatState);
    DOM.btnAdjustBudget.addEventListener('click', () => {
      DOM.settingsSection.classList.remove('hidden');
      DOM.selectWordLimit.focus();
    });
    DOM.btnTriggerSummarize.addEventListener('click', triggerSummarization);

    // Error retry & model switchers
    DOM.btnRetrySummarize.addEventListener('click', triggerSummarization);
    if (DOM.btnSwitchToLlama33) {
      DOM.btnSwitchToLlama33.addEventListener('click', () => {
        DOM.selectModel.value = 'llama-3.3-70b-versatile';
        if (DOM.customModelBox) DOM.customModelBox.classList.add('hidden');
        saveCurrentSettings();
        DOM.errorSection.classList.add('hidden');
        triggerSummarization();
      });
    }

    // Instant demo actions
    if (DOM.btnInstantDemoSummarize) {
      DOM.btnInstantDemoSummarize.addEventListener('click', triggerInstantDemoSummary);
    }
    if (DOM.btnInstantDemoFromError) {
      DOM.btnInstantDemoFromError.addEventListener('click', triggerInstantDemoSummary);
    }
    if (DOM.btnOpenSettingsFromError) {
      DOM.btnOpenSettingsFromError.addEventListener('click', () => {
        DOM.settingsSection.classList.remove('hidden');
        DOM.settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        DOM.selectModel.focus();
      });
    }

    // Result Dashboard Actions
    DOM.btnSummarizeNew.addEventListener('click', resetChatState);
    DOM.btnCopyMarkdown.addEventListener('click', copyMarkdownSummary);
    DOM.btnExportJSON.addEventListener('click', exportJSONAnalysis);
    DOM.btnPrintReport.addEventListener('click', () => window.print());

    // Transcript & Source Verifier Modal Actions
    if (DOM.btnOpenTranscriptModal) {
      DOM.btnOpenTranscriptModal.addEventListener('click', () => openTranscriptModal());
    }
    if (DOM.btnCloseTranscriptModal) {
      DOM.btnCloseTranscriptModal.addEventListener('click', closeTranscriptModal);
    }
    if (DOM.btnFooterCloseTranscriptModal) {
      DOM.btnFooterCloseTranscriptModal.addEventListener('click', closeTranscriptModal);
    }
    if (DOM.inputTranscriptSearch) {
      DOM.inputTranscriptSearch.addEventListener('input', handleTranscriptSearchInput);
    }
    if (DOM.btnClearTranscriptSearch) {
      DOM.btnClearTranscriptSearch.addEventListener('click', clearTranscriptSearch);
    }
    if (DOM.selectTranscriptParticipant) {
      DOM.selectTranscriptParticipant.addEventListener('change', handleTranscriptParticipantChange);
    }

    // Modal close on backdrop click or ESC key
    if (DOM.transcriptModal) {
      DOM.transcriptModal.addEventListener('click', (e) => {
        if (e.target === DOM.transcriptModal) closeTranscriptModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.transcriptModal && !DOM.transcriptModal.classList.contains('hidden')) {
        closeTranscriptModal();
      }
    });

    // Event delegation for "Verify in Chat" buttons in results cards
    DOM.resultsSection.addEventListener('click', handleVerifyClick);

    // Floating verify pill on text selection
    document.addEventListener('mouseup', handleTextSelection);
    if (DOM.floatingVerifyPill) {
      DOM.floatingVerifyPill.addEventListener('click', handleFloatingVerifyClick);
    }
  }

  /**
   * Toggles the API settings accordion
   */
  function toggleSettingsPanel() {
    DOM.settingsSection.classList.toggle('hidden');
    refreshLucideIcons();
  }

  /**
   * Fetches active models live from Groq using the provided key
   */
  async function handleFetchLiveModels() {
    const apiKey = DOM.inputApiKey.value.trim();
    if (!apiKey) {
      alert('Please enter your Groq API key first in the field above.');
      DOM.inputApiKey.focus();
      return;
    }

    if (DOM.fetchModelsIcon) DOM.fetchModelsIcon.classList.add('animate-spin');
    if (DOM.fetchModelsLabel) DOM.fetchModelsLabel.textContent = 'Fetching...';

    try {
      const models = await window.LLMClient.fetchAvailableModels(apiKey, DOM.inputEndpoint.value.trim());

      if (models.length === 0) {
        alert('No active models returned by provider.');
        return;
      }

      const currentSelected = DOM.selectModel.value;
      DOM.selectModel.innerHTML = '';

      models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.id} (${m.ownedBy || 'groq'})`;
        if (m.id === currentSelected || (m.id === 'llama-3.3-70b-versatile' && (!currentSelected || currentSelected === 'llama-3.1-8b-instant'))) {
          opt.selected = true;
        }
        DOM.selectModel.appendChild(opt);
      });

      // Add custom model option
      const customOpt = document.createElement('option');
      customOpt.value = 'custom_model';
      customOpt.textContent = 'Custom Model ID...';
      DOM.selectModel.appendChild(customOpt);

      if (DOM.customModelBox) DOM.customModelBox.classList.add('hidden');
      saveCurrentSettings();
      showSaveNotice(`Found ${models.length} active models from Groq!`);
    } catch (e) {
      alert(`Could not fetch live models: ${e.message}`);
    } finally {
      if (DOM.fetchModelsIcon) DOM.fetchModelsIcon.classList.remove('animate-spin');
      if (DOM.fetchModelsLabel) DOM.fetchModelsLabel.textContent = 'Fetch live models';
      refreshLucideIcons();
    }
  }

  /**
   * Saves settings to localStorage and triggers feedback
   */
  function saveCurrentSettings() {
    const apiKey = DOM.inputApiKey.value.trim();
    let model = DOM.selectModel.value;
    if (model === 'custom_model') {
      model = (DOM.inputCustomModel && DOM.inputCustomModel.value.trim()) || 'llama-3.3-70b-versatile';
    }
    const endpoint = DOM.inputEndpoint.value.trim();
    const maxWords = parseInt(DOM.selectWordLimit.value, 10);

    window.LLMClient.saveSettings({ apiKey, model, endpoint, maxWords });
    updateApiKeyStatus(apiKey);
    showSaveNotice('Settings saved in local browser storage');
  }

  /**
   * Displays temporary toast banner for saved settings
   */
  function showSaveNotice(msg = 'Settings saved') {
    DOM.saveNotice.textContent = `✓ ${msg}`;
    DOM.saveNotice.classList.remove('opacity-0');
    setTimeout(() => {
      DOM.saveNotice.classList.add('opacity-0');
    }, 2800);
  }

  /**
   * Handles native file input change event
   */
  function handleFileInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }

  /**
   * Reads file locally using HTML5 File API (FileReader)
   */
  function processFile(file) {
    if (!file) return;

    if (!file.name.endsWith('.txt') && file.type && !file.type.includes('text')) {
      alert('Please upload a chat export text file (.txt).');
      return;
    }

    currentFileName = file.name;

    const reader = new FileReader();
    reader.onload = function (event) {
      const textContent = event.target.result;
      handleLoadedChatText(textContent, file.name);
    };

    reader.onerror = function () {
      alert('Error reading local file. Please try again.');
    };

    reader.readAsText(file);
  }

  /**
   * Loads realistic embedded sample data
   */
  function loadSampleChatData() {
    if (window.SampleWhatsAppChat && window.SampleWhatsAppChat.text) {
      currentFileName = 'sample_standup_chat.txt';
      handleLoadedChatText(window.SampleWhatsAppChat.text, currentFileName);
    }
  }

  /**
   * Core orchestrator when chat text is loaded into memory
   */
  function handleLoadedChatText(rawText, filename) {
    currentRawText = rawText;
    currentFileName = filename;

    // 1. Parse text using our WhatsApp parser module
    parsedChat = window.WhatsAppParser.parseWhatsAppChat(rawText, {
      filterMedia: true,
      filterSystem: true
    });

    if (parsedChat.messages.length === 0) {
      alert('Could not detect messages in this file. Please verify it is a valid chat export (.txt).');
      return;
    }

    // 2. Compute slicing according to current word limit settings
    recalculateSlicing();

    // 3. Render Inspector UI
    renderChatInspector();

    // Hide upload zone, show inspector, hide results & error
    DOM.uploadSection.classList.add('hidden');
    DOM.chatInspectorSection.classList.remove('hidden');
    DOM.loadingSection.classList.add('hidden');
    DOM.errorSection.classList.add('hidden');
    DOM.resultsSection.classList.add('hidden');

    refreshLucideIcons();
  }

  /**
   * Recalculates message slicing based on currently configured budget
   */
  function recalculateSlicing() {
    if (!parsedChat) return;

    const settings = window.LLMClient.getSettings();
    slicedData = window.WhatsAppParser.sliceRecentMessages(parsedChat.messages, settings.maxWords);
    updateInspectorStats();
  }

  /**
   * Populates the pre-flight chat inspector UI
   */
  function renderChatInspector() {
    DOM.inspectorFileName.textContent = currentFileName;

    // Date span display
    if (parsedChat.stats.dateStart && parsedChat.stats.dateEnd) {
      DOM.inspectorDateSpan.textContent = `Date range: ${parsedChat.stats.dateStart} → ${parsedChat.stats.dateEnd}`;
    } else {
      DOM.inspectorDateSpan.textContent = `${parsedChat.messages.length} messages parsed`;
    }

    updateInspectorStats();

    // Populate Participants Badges
    DOM.inspectorParticipantsList.innerHTML = '';
    parsedChat.participants.forEach((name) => {
      const badge = document.createElement('span');
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700/80 transition';
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-brand-wa"></span> ${escapeHtml(name)}`;
      DOM.inspectorParticipantsList.appendChild(badge);
    });

    // Populate Transcript Preview
    const previewMessages = slicedData.slicedMessages.slice(0, 6);
    let previewText = previewMessages.map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`).join('\n');
    if (slicedData.slicedMessages.length > 6) {
      previewText += `\n\n... [${slicedData.slicedMessages.length - 6} more messages in LLM context payload] ...`;
    }
    DOM.rawTranscriptPreview.textContent = previewText;
  }

  /**
   * Updates stat numbers in the inspector
   */
  function updateInspectorStats() {
    if (!parsedChat || !slicedData) return;

    DOM.statTotalMessages.textContent = parsedChat.stats.totalMessages.toLocaleString();
    DOM.statParticipantsCount.textContent = parsedChat.participants.length.toString();
    DOM.statTotalWords.textContent = parsedChat.stats.totalWords.toLocaleString();
    DOM.statSlicedWords.textContent = slicedData.slicedWords.toLocaleString();

    // Show/hide slicing warning banner
    if (slicedData.isTruncated) {
      DOM.slicingAlertBanner.classList.remove('hidden');
      DOM.slicingAlertText.textContent = `Chat is long (${parsedChat.stats.totalWords.toLocaleString()} words). Automatically sending the most recent ${slicedData.slicedWords.toLocaleString()} words (${slicedData.slicedMessageCount} messages) to respect context limits.`;
    } else {
      DOM.slicingAlertBanner.classList.add('hidden');
    }
  }

  /**
   * Executes LLM Summarization flow
   */
  async function triggerSummarization() {
    const settings = window.LLMClient.getSettings();

    // Guard: Check API Key
    if (!settings.apiKey || settings.apiKey.trim().length === 0) {
      DOM.settingsSection.classList.remove('hidden');
      DOM.inputApiKey.focus();
      DOM.inputApiKey.classList.add('ring-2', 'ring-rose-500');
      setTimeout(() => DOM.inputApiKey.classList.remove('ring-2', 'ring-rose-500'), 2000);
      alert('Please enter your Groq API Key in the settings panel above to summarize this chat.');
      return;
    }

    if (!slicedData || slicedData.slicedMessages.length === 0) {
      alert('No parsed messages found to summarize.');
      return;
    }

    // Switch to Loading View
    DOM.chatInspectorSection.classList.add('hidden');
    DOM.errorSection.classList.add('hidden');
    DOM.resultsSection.classList.add('hidden');
    DOM.loadingSection.classList.remove('hidden');
    refreshLucideIcons();

    // Format transcript for LLM
    const formattedTranscript = window.WhatsAppParser.formatForLLM(slicedData.slicedMessages);

    // Progress updates
    updateLoadingStep('Preparing token-optimized transcript...', '25%');

    try {
      updateLoadingStep(`Dispatching request to Groq (${settings.model})...`, '55%');

      // Make API call
      const response = await window.LLMClient.summarizeChat(formattedTranscript, {
        apiKey: settings.apiKey,
        model: settings.model,
        endpoint: settings.endpoint
      });

      updateLoadingStep('Parsing structured intelligence & decisions...', '90%');

      lastAnalysisResult = response.data;

      // Celebrate with confetti
      triggerCompletionConfetti();

      // Render Results
      renderResultsDashboard(response.data, response.modelUsed);

      DOM.loadingSection.classList.add('hidden');
      DOM.resultsSection.classList.remove('hidden');
      refreshLucideIcons();

      // Scroll to results
      DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      console.error('Summarization Error:', err);
      DOM.loadingSection.classList.add('hidden');
      DOM.errorSection.classList.remove('hidden');
      DOM.errorMessageText.textContent = err.message || 'An unknown error occurred during API communication.';

      // Check if this was a model error to provide 1-click fallback
      const msg = (err.message || '').toLowerCase();
      if (DOM.btnSwitchToLlama33) {
        if (msg.includes('does not exist') || msg.includes('404') || msg.includes('not have access') || msg.includes('model')) {
          DOM.btnSwitchToLlama33.classList.remove('hidden');
        } else {
          DOM.btnSwitchToLlama33.classList.add('hidden');
        }
      }

      refreshLucideIcons();
    }
  }

  /**
   * Generates instant client-side summary without API key or network calls
   */
  function triggerInstantDemoSummary() {
    if (!parsedChat || !parsedChat.messages || parsedChat.messages.length === 0) {
      alert('Please upload or load a chat export first.');
      return;
    }

    try {
      const demoResult = window.LLMClient.generateOfflineSummary(parsedChat);
      lastAnalysisResult = demoResult;

      triggerCompletionConfetti();
      renderResultsDashboard(demoResult, 'Instant Client Engine');

      DOM.chatInspectorSection.classList.add('hidden');
      DOM.loadingSection.classList.add('hidden');
      DOM.errorSection.classList.add('hidden');
      DOM.resultsSection.classList.remove('hidden');
      refreshLucideIcons();

      DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      alert('Could not generate offline summary: ' + e.message);
    }
  }

  /**
   * Updates loading indicator text and progress bar width
   */
  function updateLoadingStep(statusText, progressPct) {
    if (DOM.loadingStatusText) DOM.loadingStatusText.textContent = statusText;
    if (DOM.loadingProgressBar) DOM.loadingProgressBar.style.width = progressPct;
  }

  /**
   * Renders the structured summary response into modern UI cards
   */
  function renderResultsDashboard(data, modelUsed) {
    // 1. Header Information
    DOM.resultChatTitle.textContent = data.title || 'Executive Chat Summary';
    
    if (data.chatOverview && data.chatOverview.toneAndVibe) {
      DOM.resultToneBadge.textContent = data.chatOverview.toneAndVibe;
      DOM.resultToneBadge.classList.remove('hidden');
    } else {
      DOM.resultToneBadge.classList.add('hidden');
    }

    DOM.resultModelBadge.textContent = modelUsed || 'Groq Llama 3.3';

    if (data.chatOverview && data.chatOverview.keyMetrics && data.chatOverview.keyMetrics.timeframe) {
      DOM.resultTimeframe.textContent = `Timeframe: ${data.chatOverview.keyMetrics.timeframe} • Analyzed ${slicedData.slicedMessageCount} messages`;
    } else {
      DOM.resultTimeframe.textContent = `Analyzed ${slicedData.slicedMessageCount} messages locally`;
    }

    // 2. High-Level Summary
    const summaryText = data.chatOverview ? data.chatOverview.highLevelSummary : (data.highLevelSummary || 'No summary available.');
    DOM.resultHighLevelSummary.innerHTML = `
      <p class="leading-relaxed text-slate-200">${escapeHtml(summaryText)}</p>
      <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="text-slate-400 text-[11px] flex items-center gap-1">
          <i data-lucide="info" class="w-3.5 h-3.5 text-brand-400"></i>
          Select any text or click below to check date, time & sender in the original chat
        </span>
        <button type="button" class="btn-verify-summary flex items-center gap-1.5 text-xs text-brand-400 hover:text-emerald-300 font-semibold transition px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <i data-lucide="message-square-search" class="w-3.5 h-3.5"></i>
          <span>Verify in Full Transcript</span>
        </button>
      </div>
    `;

    // 3. Decisions List
    const decisions = data.importantDecisions || [];
    DOM.decisionCountBadge.textContent = decisions.length.toString();
    DOM.resultDecisionsList.innerHTML = '';

    if (decisions.length === 0) {
      DOM.resultDecisionsList.innerHTML = '<p class="text-xs text-slate-500 italic p-3">No explicit final decisions or rulings identified in this portion of the chat.</p>';
    } else {
      decisions.forEach((item) => {
        const priorityColors = getPriorityBadgeClasses(item.priority);
        const card = document.createElement('div');
        card.className = 'p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-2';
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-bold text-white leading-snug">${escapeHtml(item.decision)}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${priorityColors}">${escapeHtml(item.priority || 'Normal')}</span>
          </div>
          ${item.rationale ? `<p class="text-[11px] text-slate-400 leading-normal">${escapeHtml(item.rationale)}</p>` : ''}
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 mt-1">
            <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
              <i data-lucide="user-check" class="w-3 h-3 text-slate-400"></i>
              <span>Decided by: <strong class="text-slate-300 font-sans">${escapeHtml(item.decidedBy || 'Team consensus')}</strong></span>
            </div>
            <button type="button" class="btn-verify-source flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 rounded-md border border-emerald-500/20 transition cursor-pointer"
              data-timestamp="${escapeHtml(item.timestamp || '')}"
              data-quote="${escapeHtml(item.sourceQuote || item.decision || '')}">
              <i data-lucide="clock" class="w-3 h-3 text-emerald-400"></i>
              <span>Verify in Chat ${item.timestamp ? `(📅 ${escapeHtml(item.timestamp)})` : ''}</span>
            </button>
          </div>
        `;
        DOM.resultDecisionsList.appendChild(card);
      });
    }

    // 4. Action Items & Tasks List (Interactive Checklist)
    const actionItems = data.actionItems || [];
    DOM.actionItemsCountBadge.textContent = actionItems.length.toString();
    DOM.resultActionItemsList.innerHTML = '';

    if (actionItems.length === 0) {
      DOM.resultActionItemsList.innerHTML = '<p class="text-xs text-slate-500 italic p-3">No pending action items or tasks detected.</p>';
    } else {
      actionItems.forEach((item, idx) => {
        const itemEl = document.createElement('div');
        const urgencyColors = getPriorityBadgeClasses(item.urgency);
        itemEl.className = 'flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition group';
        itemEl.innerHTML = `
          <input type="checkbox" id="task_${idx}" class="task-checkbox mt-1 w-4 h-4 rounded border-slate-700 text-brand-wa focus:ring-brand-500 bg-slate-950 cursor-pointer">
          <div class="task-text flex-1 space-y-1.5">
            <div class="flex items-start justify-between gap-2">
              <label for="task_${idx}" class="text-xs font-medium text-slate-200 cursor-pointer leading-snug">${escapeHtml(item.task)}</label>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${urgencyColors}">${escapeHtml(item.urgency || 'Normal')}</span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
              <div class="flex flex-wrap items-center gap-3">
                <span class="flex items-center gap-1">
                  <i data-lucide="user" class="w-3 h-3 text-brand-400"></i>
                  <span class="text-slate-300 font-sans font-medium">${escapeHtml(item.assignee || 'Unassigned')}</span>
                </span>
                ${item.deadline && item.deadline !== 'Not specified' ? `
                  <span class="flex items-center gap-1 text-rose-300 font-sans font-medium">
                    <i data-lucide="clock" class="w-3 h-3 text-rose-400"></i>
                    <span>Due: ${escapeHtml(item.deadline)}</span>
                  </span>
                ` : ''}
              </div>
              <button type="button" class="btn-verify-source flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20 transition cursor-pointer"
                data-timestamp="${escapeHtml(item.timestamp || '')}"
                data-quote="${escapeHtml(item.sourceQuote || item.task || '')}">
                <i data-lucide="clock" class="w-3 h-3 text-emerald-400"></i>
                <span>Verify in Chat ${item.timestamp ? `(📅 ${escapeHtml(item.timestamp)})` : ''}</span>
              </button>
            </div>
          </div>
        `;
        DOM.resultActionItemsList.appendChild(itemEl);
      });
    }

    // 5. Highlighted @Mentions
    const mentions = data.highlightedMentions || [];
    DOM.mentionsCountBadge.textContent = mentions.length.toString();
    DOM.resultMentionsList.innerHTML = '';

    if (mentions.length === 0) {
      DOM.resultMentionsList.innerHTML = '<p class="text-xs text-slate-500 italic p-3">No direct @mentions found in the messages.</p>';
    } else {
      mentions.forEach((m) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 rounded-xl bg-slate-900/80 border border-purple-500/20 space-y-1.5';
        itemEl.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-purple-300 font-mono flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              ${escapeHtml(m.person)}
            </span>
            ${m.from ? `<span class="text-[10px] text-slate-500 font-mono">from ${escapeHtml(m.from)}</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-300 leading-normal pl-2 border-l-2 border-purple-500/40 mt-1">${escapeHtml(m.context)}</p>
          <div class="flex justify-end pt-1">
            <button type="button" class="btn-verify-source flex items-center gap-1 text-[11px] font-mono text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 px-2 py-0.5 rounded-md border border-purple-500/25 transition cursor-pointer"
              data-timestamp="${escapeHtml(m.timestamp || '')}"
              data-quote="${escapeHtml(m.sourceQuote || m.context || '')}">
              <i data-lucide="clock" class="w-3 h-3 text-purple-400"></i>
              <span>Verify in Chat ${m.timestamp ? `(📅 ${escapeHtml(m.timestamp)})` : ''}</span>
            </button>
          </div>
        `;
        DOM.resultMentionsList.appendChild(itemEl);
      });
    }

    // 6. Deadlines & Milestones
    const deadlines = data.deadlinesSummary || [];
    DOM.deadlinesCountBadge.textContent = deadlines.length.toString();
    DOM.resultDeadlinesList.innerHTML = '';

    if (deadlines.length === 0) {
      DOM.resultDeadlinesList.innerHTML = '<p class="text-xs text-slate-500 italic p-3">No specific deadlines detected.</p>';
    } else {
      deadlines.forEach((dl) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2';
        itemEl.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-0.5">
              <span class="text-xs font-semibold text-white block">${escapeHtml(dl.event)}</span>
              <span class="text-[10px] font-mono text-rose-300 flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(dl.dateOrTime)}
              </span>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              ${escapeHtml(dl.status || 'Upcoming')}
            </span>
          </div>
          <div class="flex justify-end pt-1 border-t border-slate-800/60">
            <button type="button" class="btn-verify-source flex items-center gap-1 text-[11px] font-mono text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/20 transition cursor-pointer"
              data-timestamp="${escapeHtml(dl.timestamp || '')}"
              data-quote="${escapeHtml(dl.sourceQuote || dl.event || '')}">
              <i data-lucide="clock" class="w-3 h-3 text-rose-400"></i>
              <span>Verify in Chat ${dl.timestamp ? `(📅 ${escapeHtml(dl.timestamp)})` : ''}</span>
            </button>
          </div>
        `;
        DOM.resultDeadlinesList.appendChild(itemEl);
      });
    }

    // 7. Participant Activity Breakdown
    renderParticipantActivityBreakdown();
  }

  /**
   * Calculates and renders the message contribution percentages per participant
   */
  function renderParticipantActivityBreakdown() {
    if (!parsedChat || !DOM.resultParticipantsBreakdown) return;

    // Count messages per participant
    const counts = {};
    parsedChat.messages.forEach((m) => {
      counts[m.sender] = (counts[m.sender] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = parsedChat.messages.length;

    DOM.resultParticipantsBreakdown.innerHTML = '';
    sorted.forEach(([name, count]) => {
      const pct = Math.round((count / total) * 100);
      const row = document.createElement('div');
      row.className = 'space-y-1';
      row.innerHTML = `
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-slate-300 truncate max-w-[150px]">${escapeHtml(name)}</span>
          <span class="font-mono text-slate-500">${count} msgs (${pct}%)</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div class="bg-brand-wa h-1.5 rounded-full" style="width: ${pct}%"></div>
        </div>
      `;
      DOM.resultParticipantsBreakdown.appendChild(row);
    });
  }

  /**
   * Delegated click handler for "Verify in Chat" buttons on summary cards
   */
  function handleVerifyClick(e) {
    const btn = e.target.closest('.btn-verify-source');
    if (btn) {
      const timestamp = btn.getAttribute('data-timestamp') || '';
      const quote = btn.getAttribute('data-quote') || '';
      openTranscriptModal({ timestamp, quote });
      return;
    }

    const summaryBtn = e.target.closest('.btn-verify-summary');
    if (summaryBtn) {
      openTranscriptModal();
      return;
    }
  }

  /**
   * Opens the interactive Chat Transcript modal and verifies/highlights messages
   */
  function openTranscriptModal(options = {}) {
    if (!parsedChat || !parsedChat.messages || parsedChat.messages.length === 0) {
      alert('No parsed chat messages available to display.');
      return;
    }

    const { timestamp = '', quote = '', query = '' } = options;

    if (DOM.modalActiveFileBadge) {
      DOM.modalActiveFileBadge.textContent = currentFileName || 'chat_export.txt';
    }

    // Populate participant dropdown
    if (DOM.selectTranscriptParticipant) {
      const currentSelected = DOM.selectTranscriptParticipant.value;
      DOM.selectTranscriptParticipant.innerHTML = '<option value="">All Participants</option>';
      parsedChat.participants.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === currentSelected) opt.selected = true;
        DOM.selectTranscriptParticipant.appendChild(opt);
      });
    }

    // Show modal
    DOM.transcriptModal.classList.remove('hidden');

    // If query/quote/timestamp provided, populate search input
    const initialSearch = (quote || query || timestamp || '').trim();
    if (DOM.inputTranscriptSearch) {
      DOM.inputTranscriptSearch.value = initialSearch;
      if (DOM.btnClearTranscriptSearch) {
        DOM.btnClearTranscriptSearch.classList.toggle('hidden', initialSearch.length === 0);
      }
    }

    // Filter and render messages
    filterAndRenderTranscript(options);

    refreshLucideIcons();
  }

  /**
   * Closes the transcript verification modal
   */
  function closeTranscriptModal() {
    if (DOM.transcriptModal) {
      DOM.transcriptModal.classList.add('hidden');
    }
  }

  /**
   * Handles user input inside transcript search bar
   */
  function handleTranscriptSearchInput() {
    const val = DOM.inputTranscriptSearch.value.trim();
    if (DOM.btnClearTranscriptSearch) {
      DOM.btnClearTranscriptSearch.classList.toggle('hidden', val.length === 0);
    }
    filterAndRenderTranscript();
  }

  /**
   * Clears transcript search
   */
  function clearTranscriptSearch() {
    DOM.inputTranscriptSearch.value = '';
    if (DOM.btnClearTranscriptSearch) DOM.btnClearTranscriptSearch.classList.add('hidden');
    filterAndRenderTranscript();
  }

  /**
   * Handles participant change in transcript filter
   */
  function handleTranscriptParticipantChange() {
    filterAndRenderTranscript();
  }

  /**
   * Filters and renders transcript messages with highlighting
   */
  function filterAndRenderTranscript(options = {}) {
    if (!parsedChat) return;

    const searchTerm = DOM.inputTranscriptSearch.value.trim();
    const selectedParticipant = DOM.selectTranscriptParticipant.value;

    let displayList = [];
    let highlightTargetId = null;

    if (searchTerm || options.timestamp || options.quote) {
      // Use our smart scoring parser
      const criteria = {
        timestamp: options.timestamp || '',
        quote: options.quote || searchTerm,
        query: searchTerm,
        sender: selectedParticipant
      };

      const matched = window.WhatsAppParser.findMatchingMessages(criteria, parsedChat.messages);

      // Filter by participant if chosen
      let filtered = matched;
      if (selectedParticipant) {
        filtered = filtered.filter(item => item.message.sender === selectedParticipant);
      }

      displayList = filtered.map(item => item.message);

      if (filtered.length > 0) {
        highlightTargetId = filtered[0].message.id;
      }
    } else {
      // No search term: show all (filtered by participant if any)
      if (selectedParticipant) {
        displayList = parsedChat.messages.filter(m => m.sender === selectedParticipant);
      } else {
        displayList = parsedChat.messages;
      }
    }

    // Update match counter
    if (DOM.transcriptMatchCounter) {
      if (searchTerm) {
        DOM.transcriptMatchCounter.textContent = `Found ${displayList.length} matching message${displayList.length === 1 ? '' : 's'} for "${searchTerm}"`;
      } else if (selectedParticipant) {
        DOM.transcriptMatchCounter.textContent = `Showing ${displayList.length} message${displayList.length === 1 ? '' : 's'} from ${selectedParticipant}`;
      } else {
        DOM.transcriptMatchCounter.textContent = `Showing all ${displayList.length} messages in conversation`;
      }
    }

    // Render cards
    renderTranscriptCards(displayList, searchTerm, highlightTargetId);
  }

  /**
   * Renders the message cards in the transcript container with dates, times, senders, and highlights
   */
  function renderTranscriptCards(messages, highlightKeyword, targetId) {
    DOM.transcriptMessagesContainer.innerHTML = '';

    if (messages.length === 0) {
      DOM.transcriptMessagesContainer.innerHTML = `
        <div class="text-center py-12 text-slate-500 space-y-2">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto text-slate-600"></i>
          <p class="text-sm">No messages match the current search filters.</p>
          <button type="button" onclick="window.clearTranscriptFilters()" class="text-xs text-brand-400 hover:underline">Clear search & filters</button>
        </div>
      `;
      refreshLucideIcons();
      return;
    }

    let targetEl = null;

    messages.forEach((msg) => {
      const card = document.createElement('div');
      card.id = `msg_card_${msg.id}`;
      const isTarget = targetId && msg.id === targetId;

      card.className = `p-4 rounded-xl border transition duration-300 relative ${
        isTarget 
          ? 'bg-slate-900 border-brand-wa ring-1 ring-brand-wa shadow-lg shadow-brand-wa/20 highlight-flash' 
          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
      }`;

      // Highlight matching keywords in message content
      let displayContent = escapeHtml(msg.content);
      if (highlightKeyword && highlightKeyword.length > 1) {
        try {
          const regex = new RegExp(`(${escapeRegex(highlightKeyword)})`, 'gi');
          displayContent = displayContent.replace(regex, '<mark class="chat-match">$1</mark>');
        } catch (e) {
          // Ignore regex syntax errors for special characters
        }
      }

      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/60">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-slate-800 text-brand-400 font-bold text-xs flex items-center justify-center border border-slate-700">
              ${escapeHtml(msg.sender.charAt(0).toUpperCase())}
            </span>
            <span class="text-xs font-bold text-white">${escapeHtml(msg.sender)}</span>
          </div>

          <!-- Prominent Exact Timestamp Badge (Date and Time Sent) -->
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm" title="Exact timestamp when this message was sent">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span class="font-semibold">${escapeHtml(msg.timestamp || 'Unknown Time')}</span>
            </span>
            <button type="button" class="btn-copy-msg p-1 text-slate-400 hover:text-white rounded" title="Copy message" data-text="${escapeHtml(msg.content)}">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        ${isTarget ? `
          <div class="mb-2 py-1 px-2.5 rounded-md bg-brand-wa/15 border border-brand-wa/30 text-emerald-300 text-[11px] flex items-center gap-1.5 font-medium animate-pulse">
            <i data-lucide="check-circle" class="w-3.5 h-3.5 text-brand-wa"></i>
            <span>Verified Source Message • Sent at <strong>${escapeHtml(msg.timestamp)}</strong> by <strong>${escapeHtml(msg.sender)}</strong></span>
          </div>
        ` : ''}

        <p class="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">${displayContent}</p>
      `;

      // Copy message button listener
      const copyBtn = card.querySelector('.btn-copy-msg');
      if (copyBtn) {
        copyBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          navigator.clipboard.writeText(msg.content);
          copyBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>';
          refreshLucideIcons();
          setTimeout(() => {
            copyBtn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i>';
            refreshLucideIcons();
          }, 1500);
        });
      }

      DOM.transcriptMessagesContainer.appendChild(card);

      if (isTarget) {
        targetEl = card;
      }
    });

    refreshLucideIcons();

    // Scroll target into view
    if (targetEl) {
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  // Global helper for clearing filters inside empty state
  window.clearTranscriptFilters = function () {
    if (DOM.inputTranscriptSearch) DOM.inputTranscriptSearch.value = '';
    if (DOM.selectTranscriptParticipant) DOM.selectTranscriptParticipant.value = '';
    filterAndRenderTranscript();
  };

  /**
   * Handles text selection inside summary cards for floating verify pill
   */
  function handleTextSelection(e) {
    if (!DOM.floatingVerifyPill) return;

    if (e.target.closest('#floatingVerifyPill')) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text || text.length < 3 || !DOM.resultsSection.contains(selection.anchorNode)) {
      DOM.floatingVerifyPill.classList.add('hidden');
      selectedSummaryText = '';
      return;
    }

    selectedSummaryText = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    DOM.floatingVerifyPill.style.top = `${window.scrollY + rect.top - 40}px`;
    DOM.floatingVerifyPill.style.left = `${window.scrollX + rect.left + rect.width / 2 - 80}px`;
    DOM.floatingVerifyPill.classList.remove('hidden');
    refreshLucideIcons();
  }

  /**
   * Triggered when clicking floating verify pill on selected text
   */
  function handleFloatingVerifyClick() {
    if (!selectedSummaryText) return;
    DOM.floatingVerifyPill.classList.add('hidden');
    openTranscriptModal({ quote: selectedSummaryText, query: selectedSummaryText });
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Resets chat state to allow uploading a new file
   */
  function resetChatState() {
    currentRawText = '';
    currentFileName = '';
    parsedChat = null;
    slicedData = null;
    lastAnalysisResult = null;
    DOM.fileInput.value = '';

    DOM.uploadSection.classList.remove('hidden');
    DOM.chatInspectorSection.classList.add('hidden');
    DOM.loadingSection.classList.add('hidden');
    DOM.errorSection.classList.add('hidden');
    DOM.resultsSection.classList.add('hidden');
    if (DOM.transcriptModal) DOM.transcriptModal.classList.add('hidden');
    if (DOM.floatingVerifyPill) DOM.floatingVerifyPill.classList.add('hidden');

    refreshLucideIcons();
  }

  /**
   * Copies formatted markdown summary to system clipboard
   */
  function copyMarkdownSummary() {
    if (!lastAnalysisResult) return;

    let md = `# ${lastAnalysisResult.title || 'Chat Summary'}\n\n`;

    if (lastAnalysisResult.chatOverview) {
      md += `## Executive Summary\n${lastAnalysisResult.chatOverview.highLevelSummary}\n\n`;
      if (lastAnalysisResult.chatOverview.toneAndVibe) {
        md += `*Tone:* ${lastAnalysisResult.chatOverview.toneAndVibe}\n\n`;
      }
    }

    if (lastAnalysisResult.importantDecisions && lastAnalysisResult.importantDecisions.length > 0) {
      md += `## Important Decisions\n`;
      lastAnalysisResult.importantDecisions.forEach((d) => {
        const timeStr = d.timestamp ? ` [Sent: ${d.timestamp}]` : '';
        md += `- **[${d.priority || 'Normal'}] ${d.decision}** (Decided by: ${d.decidedBy || 'Team'})${timeStr}\n`;
        if (d.rationale) md += `  *Context:* ${d.rationale}\n`;
      });
      md += '\n';
    }

    if (lastAnalysisResult.actionItems && lastAnalysisResult.actionItems.length > 0) {
      md += `## Action Items & Tasks\n`;
      lastAnalysisResult.actionItems.forEach((a) => {
        const deadline = a.deadline ? ` | Due: ${a.deadline}` : '';
        const timeStr = a.timestamp ? ` (Requested: ${a.timestamp})` : '';
        md += `- [ ] **${a.task}** (@${a.assignee || 'Unassigned'}${deadline}) [${a.urgency || 'Normal'}]${timeStr}\n`;
      });
      md += '\n';
    }

    if (lastAnalysisResult.deadlinesSummary && lastAnalysisResult.deadlinesSummary.length > 0) {
      md += `## Deadlines\n`;
      lastAnalysisResult.deadlinesSummary.forEach((dl) => {
        const timeStr = dl.timestamp ? ` (From message: ${dl.timestamp})` : '';
        md += `- **${dl.event}**: ${dl.dateOrTime} (${dl.status || 'Upcoming'})${timeStr}\n`;
      });
      md += '\n';
    }

    if (lastAnalysisResult.highlightedMentions && lastAnalysisResult.highlightedMentions.length > 0) {
      md += `## Highlighted Mentions\n`;
      lastAnalysisResult.highlightedMentions.forEach((m) => {
        const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
        md += `- **${m.person}** (from ${m.from || 'Group'})${timeStr}: ${m.context}\n`;
      });
      md += '\n';
    }

    navigator.clipboard.writeText(md).then(() => {
      DOM.copyMarkdownLabel.textContent = 'Copied!';
      setTimeout(() => {
        DOM.copyMarkdownLabel.textContent = 'Copy Markdown';
      }, 2000);
    }).catch(() => {
      alert('Failed to copy to clipboard.');
    });
  }

  /**
   * Downloads analysis JSON data as a local file
   */
  function exportJSONAnalysis() {
    if (!lastAnalysisResult) return;

    const jsonStr = JSON.stringify(lastAnalysisResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_summary_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Triggers canvas confetti celebration
   */
  function triggerCompletionConfetti() {
    if (typeof window.confetti === 'function') {
      window.confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#25D366', '#10b981', '#34d399', '#ffffff']
      });
    }
  }

  /**
   * Helper utility to determine priority badge styling
   */
  function getPriorityBadgeClasses(priority) {
    const p = (priority || '').toLowerCase();
    if (p.includes('urgent')) {
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    } else if (p.includes('high')) {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  }

  /**
   * HTML escape utility for XSS safety
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Boot on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
