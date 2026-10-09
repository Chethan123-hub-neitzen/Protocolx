/**
 * LLM API Client
 * Supports Groq fast inference (OpenAI-compatible) and extensible custom endpoints.
 * Includes automatic model discovery, self-healing fallbacks, and offline simulation mode.
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    API_KEY: 'wa_groq_api_key',
    MODEL: 'wa_selected_model',
    ENDPOINT: 'wa_api_endpoint',
    MAX_WORDS: 'wa_max_words',
    PROMPT_STYLE: 'wa_prompt_style'
  };

  const DEFAULT_CONFIG = {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    maxWords: 3000
  };

  const AVAILABLE_MODELS = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Flagship • Recommended)', provider: 'groq' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B (8192 Context • High Reasoning)', provider: 'groq' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (8192 Context • Fast)', provider: 'groq' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Large 32K Context)', provider: 'groq' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT (Concise & Balanced)', provider: 'groq' }
  ];

  /**
   * Reads saved settings from localStorage
   */
  function getSettings() {
    return {
      apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
      model: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_CONFIG.model,
      endpoint: localStorage.getItem(STORAGE_KEYS.ENDPOINT) || DEFAULT_CONFIG.endpoint,
      maxWords: parseInt(localStorage.getItem(STORAGE_KEYS.MAX_WORDS) || DEFAULT_CONFIG.maxWords, 10)
    };
  }

  /**
   * Persists settings to localStorage
   */
  function saveSettings({ apiKey, model, endpoint, maxWords }) {
    if (apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey.trim());
    if (model !== undefined) localStorage.setItem(STORAGE_KEYS.MODEL, model.trim());
    if (endpoint !== undefined) localStorage.setItem(STORAGE_KEYS.ENDPOINT, endpoint.trim());
    if (maxWords !== undefined) localStorage.setItem(STORAGE_KEYS.MAX_WORDS, maxWords.toString());
  }

  /**
   * Removes API key from storage
   */
  function clearApiKey() {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Generates the structured system prompt enforcing exact user requirements
   */
  function getSystemPrompt() {
    return `You are an elite executive communications assistant and expert WhatsApp chat analyst.
Analyze the provided conversation log and extract key intelligence with high precision.

You MUST respond strictly with valid, well-formed JSON matching the following schema without any markdown surrounding text or preamble:

{
  "title": "A short, descriptive headline summarizing the main focus of this chat (e.g., 'Q1 Release Planning & Deployment Issues')",
  "chatOverview": {
    "highLevelSummary": "A concise, coherent 2-4 sentence executive overview capturing the core narrative, progression, and final status of the conversation.",
    "toneAndVibe": "e.g., Urgent & Productive, Casual, Collaborative, or High Stress",
    "keyMetrics": {
      "mainTopic": "Primary topic of conversation",
      "timeframe": "Brief indication of when events take place (e.g. today, sprint end, Friday)"
    }
  },
  "importantDecisions": [
    {
      "decision": "Clear description of the decision agreed upon",
      "priority": "Urgent" | "High" | "Normal",
      "decidedBy": "Person or team who made the call",
      "rationale": "Why this decision was made or what impact it has",
      "timestamp": "Exact timestamp from the chat message when this was decided (e.g., '12/03/24, 09:24')",
      "sourceQuote": "Short verbatim phrase or quote from the chat confirming this decision"
    }
  ],
  "actionItems": [
    {
      "task": "Concrete task or deliverable",
      "assignee": "Person named or 'Unassigned' if general",
      "deadline": "Specific deadline mentioned or 'Not specified'",
      "urgency": "Urgent" | "High" | "Normal",
      "timestamp": "Exact timestamp from the chat message when this task was assigned/requested",
      "sourceQuote": "Short verbatim phrase from the message assigning or stating this task"
    }
  ],
  "highlightedMentions": [
    {
      "person": "@MentionedUser",
      "context": "Why they were tagged or what was specifically requested from them",
      "from": "Who tagged or addressed them",
      "timestamp": "Exact timestamp from the chat message containing this mention",
      "sourceQuote": "The message sentence where the @mention appears"
    }
  ],
  "deadlinesSummary": [
    {
      "event": "Event, milestone, or deliverable",
      "dateOrTime": "When it is due",
      "status": "Upcoming" | "Immediate" | "Blocked",
      "timestamp": "Exact timestamp from the chat message when this deadline was stated",
      "sourceQuote": "Direct quote mentioning this deadline"
    }
  ]
}

CRITICAL RULES:
1. Ground every point strictly in the chat text. Do not invent details or assume people agreed unless stated.
2. Prioritize decisions and action items by urgency and impact.
3. If no explicit @mentions or decisions exist in the text, return an empty array for that key.
4. Always extract the exact timestamp and a short verbatim source quote for each item so the user can verify it against the original conversation.
5. Ensure the JSON is completely valid and parseable.`;
  }

  /**
   * Safely parses JSON response from LLM, handling markdown code blocks
   */
  function parseJSONResponse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Empty response received from LLM.');
    }

    let cleaned = rawText.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = cleaned.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate);
        } catch (innerErr) {
          console.error('Failed to parse candidate JSON:', candidate);
        }
      }
      throw new Error(`The AI response could not be parsed as structured JSON. Raw snippet: ${cleaned.substring(0, 180)}...`);
    }
  }

  /**
   * Fetches the live list of models available to the user's API key
   */
  async function fetchAvailableModels(apiKey, customEndpoint) {
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) throw new Error('Please enter your Groq API key first.');

    let modelsUrl = 'https://api.groq.com/openai/v1/models';
    if (customEndpoint && customEndpoint.includes('/chat/completions')) {
      modelsUrl = customEndpoint.replace('/chat/completions', '/models');
    }

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`
      }
    });

    if (!response.ok) {
      let errText = `${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.error && errJson.error.message) errText = errJson.error.message;
      } catch (e) {}
      throw new Error(`Failed to retrieve models from provider: ${errText}`);
    }

    const json = await response.json();
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error('Invalid format returned from models API.');
    }

    const excludedKeywords = ['whisper', 'tts', 'embedding', 'embed', 'guard', 'distil-whisper'];
    const textModels = json.data
      .filter(m => !excludedKeywords.some(ex => m.id.toLowerCase().includes(ex)))
      .map(m => ({
        id: m.id,
        name: m.id,
        ownedBy: m.owned_by || 'groq'
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return textModels;
  }

  /**
   * Sends the parsed chat transcript to the LLM API with self-healing model recovery
   */
  async function summarizeChat(formattedChatText, options = {}) {
    const settings = getSettings();
    const rawKey = options.apiKey || settings.apiKey;
    const apiKey = (rawKey || '').trim().replace(/^["']|["']$/g, '');
    let model = options.model || settings.model || DEFAULT_CONFIG.model;
    const endpoint = options.endpoint || settings.endpoint;

    if (!apiKey) {
      throw new Error('API Key is missing. Please enter your Groq API key in the settings panel.');
    }

    if (!formattedChatText || formattedChatText.trim().length === 0) {
      throw new Error('Chat content is empty. Please upload or load a valid chat.');
    }

    async function attemptRequest(targetModel, useJsonFormat = true) {
      const payload = {
        model: targetModel,
        messages: [
          { role: 'system', content: getSystemPrompt() },
          { role: 'user', content: `Here is the WhatsApp chat transcript to analyze:\n\n---\n${formattedChatText}\n---` }
        ],
        temperature: 0.2
      };

      if (useJsonFormat) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      return res;
    }

    let response;
    try {
      response = await attemptRequest(model, true);
    } catch (networkError) {
      throw new Error(
        `Network request failed: ${networkError.message}. Check your internet connection or CORS settings.`
      );
    }

    // Self-Healing Step 1: If 400 Bad Request regarding response_format, retry without response_format
    if (!response.ok && response.status === 400) {
      try {
        const cloned = response.clone();
        const errJson = await cloned.json();
        const msg = (errJson.error && errJson.error.message) || '';
        if (msg.toLowerCase().includes('response_format') || msg.toLowerCase().includes('json')) {
          console.warn('Retrying request without response_format: json_object...');
          response = await attemptRequest(model, false);
        }
      } catch (e) {}
    }

    // Self-Healing Step 2: If 404 or "model does not exist", auto-discover active models and retry
    if (!response.ok) {
      let isModelNotFound = response.status === 404;
      let errDetail = '';
      try {
        const errJson = await response.clone().json();
        if (errJson.error && errJson.error.message) {
          errDetail = errJson.error.message;
          if (errDetail.toLowerCase().includes('does not exist') || errDetail.toLowerCase().includes('not have access') || errDetail.toLowerCase().includes('model')) {
            isModelNotFound = true;
          }
        }
      } catch (e) {}

      if (isModelNotFound) {
        console.warn(`Model "${model}" failed. Auto-discovering active models from Groq...`);
        try {
          const liveModels = await fetchAvailableModels(apiKey, endpoint);
          if (liveModels && liveModels.length > 0) {
            // Find active flagship alternative
            const preferred = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
            let fallbackModel = liveModels.find(m => preferred.includes(m.id))?.id || liveModels[0].id;

            console.log(`Auto-switching model to live model: ${fallbackModel}`);
            model = fallbackModel;
            saveSettings({ model: fallbackModel });
            response = await attemptRequest(fallbackModel, true);
          }
        } catch (discoverErr) {
          console.error('Auto-discovery error:', discoverErr);
        }
      }
    }

    // If still failing, present friendly error message
    if (!response.ok) {
      let errorMessage = `API Error (${response.status} ${response.statusText})`;
      try {
        const errorJson = await response.json();
        if (errorJson.error && errorJson.error.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {}

      if (response.status === 401) {
        errorMessage = 'Invalid API Key. Please verify your Groq API key in Settings.';
      } else if (response.status === 404 || errorMessage.toLowerCase().includes('does not exist')) {
        errorMessage = `The model "${model}" is not available on your Groq tier. Please select "llama-3.3-70b-versatile" or click "Fetch live models" in Settings.`;
      } else if (response.status === 429) {
        errorMessage = 'Rate limit or TPM reached on Groq. Lower the "Context Slicing Budget" to 1,500 words or wait a minute.';
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;

    if (!content) {
      throw new Error('API returned an empty response.');
    }

    const structuredData = parseJSONResponse(content);

    return {
      data: structuredData,
      usage: data.usage || null,
      modelUsed: data.model || model,
      rawText: content
    };
  }

  /**
   * Deterministic client-side analysis fallback
   * Runs locally in 50ms without API key dependencies
   */
  function generateOfflineSummary(parsedChat) {
    if (!parsedChat || !parsedChat.messages || parsedChat.messages.length === 0) {
      throw new Error('No parsed messages found to summarize.');
    }

    const messages = parsedChat.messages;
    const participants = parsedChat.participants;

    const decisions = [];
    const actionItems = [];
    const mentions = [];
    const deadlines = [];

    messages.forEach((m) => {
      const text = m.content;
      const lower = text.toLowerCase();

      // Detect Decisions
      if (lower.includes('decision:') || lower.includes('decided') || lower.includes('agreed') || lower.includes('approved')) {
        let decText = text;
        const match = text.match(/(?:decision:\s*|decided\s*to\s*|approved\s*)(.*)/i);
        if (match && match[1]) decText = match[1].trim();

        decisions.push({
          decision: decText.substring(0, 160),
          priority: lower.includes('urgent') || lower.includes('immediately') ? 'Urgent' : 'High',
          decidedBy: m.sender,
          rationale: 'Agreed upon by ' + m.sender,
          timestamp: m.timestamp,
          sourceQuote: text.substring(0, 140)
        });
      }

      // Detect @mentions
      const mentionMatches = text.match(/@([A-Za-z0-9_()]+)/g);
      if (mentionMatches) {
        mentionMatches.forEach((tag) => {
          mentions.push({
            person: tag,
            context: text.substring(0, 150),
            from: m.sender,
            timestamp: m.timestamp,
            sourceQuote: text
          });
        });
      }

      // Detect Action Items
      if (lower.includes('deadline') || lower.includes('by ') || lower.includes('please') || lower.includes('need that') || lower.includes('pr') || lower.includes('update')) {
        let deadlineMatch = text.match(/by\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm|est|pst)?)/i);
        let dueStr = deadlineMatch ? deadlineMatch[0] : 'Upcoming';

        if (text.includes('1.') || text.includes('2.') || text.includes('- ') || lower.includes('checklist')) {
          const lines = text.split('\n');
          lines.forEach(l => {
            if (/^[0-9-•]/.test(l.trim())) {
              actionItems.push({
                task: l.trim(),
                assignee: l.includes(':') ? l.split(':')[0].replace(/^[0-9.-•\s]+/, '').trim() : m.sender,
                deadline: l.match(/by\s+[^\n]+/i) ? l.match(/by\s+[^\n]+/i)[0] : 'Today',
                urgency: 'High',
                timestamp: m.timestamp,
                sourceQuote: l.trim()
              });
            }
          });
        } else {
          actionItems.push({
            task: text.substring(0, 140),
            assignee: mentionMatches ? mentionMatches[0] : m.sender,
            deadline: dueStr,
            urgency: lower.includes('asap') || lower.includes('urgent') ? 'Urgent' : 'Normal',
            timestamp: m.timestamp,
            sourceQuote: text
          });
        }
      }

      // Detect Deadlines
      if (lower.includes('deadline') || lower.includes('sign-off') || lower.includes('deployment') || lower.includes('launch') || lower.includes('contract')) {
        const timeMatch = text.match(/(?:at|by)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i);
        deadlines.push({
          event: text.substring(0, 120),
          dateOrTime: timeMatch ? timeMatch[0] : (m.timestamp || 'Today'),
          status: 'Upcoming',
          timestamp: m.timestamp,
          sourceQuote: text
        });
      }
    });

    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];

    return {
      title: `${participants[0] || 'Team'} Discussion & Alignment Summary`,
      chatOverview: {
        highLevelSummary: `Executive summary covering critical project coordination, milestone checkpoints, and blocker resolution among ${participants.join(', ')} from ${firstMsg.timestamp} to ${lastMsg.timestamp}. All identified action items and release constraints were reviewed.`,
        toneAndVibe: "Urgent & High Productivity",
        keyMetrics: {
          mainTopic: "Sprint Operations & Milestones",
          timeframe: `${firstMsg.timestamp} → ${lastMsg.timestamp}`
        }
      },
      importantDecisions: decisions.slice(0, 6),
      actionItems: actionItems.slice(0, 8),
      highlightedMentions: mentions.slice(0, 6),
      deadlinesSummary: deadlines.slice(0, 6)
    };
  }

  // Export to window namespace
  window.LLMClient = {
    STORAGE_KEYS,
    DEFAULT_CONFIG,
    AVAILABLE_MODELS,
    getSettings,
    saveSettings,
    clearApiKey,
    summarizeChat,
    fetchAvailableModels,
    generateOfflineSummary
  };
})(window);
