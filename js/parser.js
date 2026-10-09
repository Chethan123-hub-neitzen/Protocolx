/**
 * WhatsApp Chat Parser
 * Handles export formats from iOS and Android devices,
 * cleans system noise, strips media tags, and prepares optimized text for LLM inference.
 */

(function (window) {
  'use strict';

  // Invisible unicode marks commonly present in WhatsApp exports
  const UNICODE_MARKS_REGEX = /[\u200e\u200f\u202a-\u202e\u202f\u200b\ufeff]/g;

  // Typical WhatsApp system notifications
  const SYSTEM_PATTERNS = [
    /Messages and calls are end-to-end encrypted/i,
    /created group/i,
    /added/i,
    /left/i,
    /removed/i,
    /changed the subject to/i,
    /changed the group/i,
    /changed their phone number/i,
    /security code changed/i,
    /pinned a message/i,
    /This message was deleted/i,
    /You deleted this message/i,
    /Waiting for this message/i,
    /joined using this group's invite link/i,
    /changed this group's settings/i,
    /started a call/i
  ];

  // Media attachment markers
  const MEDIA_OMITTED_PATTERNS = [
    /<Media omitted>/i,
    /<image omitted>/i,
    /<video omitted>/i,
    /<audio omitted>/i,
    /<sticker omitted>/i,
    /<document omitted>/i,
    /<Contact card omitted>/i,
    /image omitted/i,
    /video omitted/i,
    /audio omitted/i,
    /sticker omitted/i,
    /document omitted/i,
    /GIF omitted/i
  ];

  /**
   * Sanitizes raw text string from invisible unicode artifacts
   */
  function cleanInvisibleChars(str) {
    if (!str) return '';
    return str.replace(UNICODE_MARKS_REGEX, '').trim();
  }

  /**
   * Tests if a message is a media placeholder
   */
  function isMediaOmitted(content) {
    return MEDIA_OMITTED_PATTERNS.some(pattern => pattern.test(content));
  }

  /**
   * Tests if a message line is an automated WhatsApp system notification
   */
  function isSystemNotification(sender, content) {
    if (!sender) return true;
    const combined = `${sender}: ${content}`;
    return SYSTEM_PATTERNS.some(pattern => pattern.test(combined) || pattern.test(content));
  }

  /**
   * Main parsing engine for WhatsApp export files
   * Supports:
   * 1. Android: "DD/MM/YYYY, HH:MM - Sender: Message" or "M/D/YY, H:MM AM - Sender: Message"
   * 2. iOS: "[DD/MM/YY, HH:MM:SS] Sender: Message" or "[MM/DD/YYYY, H:MM:SS AM] Sender: Message"
   */
  function parseWhatsAppChat(rawText, options = {}) {
    const {
      filterMedia = true,
      filterSystem = true,
      compactTimestamps = true
    } = options;

    if (!rawText || typeof rawText !== 'string') {
      return {
        messages: [],
        participants: [],
        stats: { totalRawLines: 0, totalMessages: 0, totalWords: 0, dateStart: null, dateEnd: null }
      };
    }

    const lines = rawText.split(/\r?\n/);
    const messages = [];
    const participantSet = new Set();

    // Regex 1: iOS bracket format: [12/03/24, 10:15:30 AM] Sender: Message
    const iosRegex = /^\[(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{1,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\]\s*([^:]+?):\s*(.*)$/;
    
    // Regex 2: Android standard format: 12/03/24, 10:15 am - Sender: Message
    const androidRegex = /^(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{1,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*[-–—]\s*([^:]+?):\s*(.*)$/;

    // Regex 3: Fallback without sender (system messages or anonymous broadcast)
    const systemLineRegex = /^(?:\[(.*?)\]|(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{1,4},\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*[-–—])\s*(.*)$/;

    let currentMessage = null;

    for (let i = 0; i < lines.length; i++) {
      let rawLine = cleanInvisibleChars(lines[i]);
      if (!rawLine) continue;

      let match = rawLine.match(iosRegex) || rawLine.match(androidRegex);

      if (match) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const timestampStr = match[1].trim();
        const sender = match[2].trim();
        let content = match[3].trim();

        // Check if sender looks like a system notice
        const isSys = isSystemNotification(sender, content);
        const isMedia = isMediaOmitted(content);

        if (filterSystem && isSys) {
          currentMessage = null;
          continue;
        }

        if (filterMedia && isMedia) {
          // Replace media with tiny compact tag to save tokens
          content = '[Media Attachment]';
        }

        participantSet.add(sender);

        currentMessage = {
          id: messages.length + 1,
          timestamp: timestampStr,
          sender: sender,
          content: content,
          isMedia: isMedia
        };
      } else {
        // Could be a system message line without sender
        const sysMatch = rawLine.match(systemLineRegex);
        if (sysMatch && filterSystem) {
          // It's a timestamped system event (e.g. "Security code changed")
          continue;
        }

        // Multiline message continuation: append to currentMessage
        if (currentMessage) {
          currentMessage.content += '\n' + rawLine;
        }
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    // Compute basic statistics
    let totalWords = 0;
    messages.forEach(m => {
      const words = m.content.trim().split(/\s+/).filter(Boolean).length;
      m.wordCount = words;
      totalWords += words;
    });

    const participants = Array.from(participantSet).sort();
    const dateStart = messages.length > 0 ? messages[0].timestamp : null;
    const dateEnd = messages.length > 0 ? messages[messages.length - 1].timestamp : null;

    return {
      messages,
      participants,
      stats: {
        totalRawLines: lines.length,
        totalMessages: messages.length,
        totalWords,
        dateStart,
        dateEnd
      }
    };
  }

  /**
   * Slices messages to satisfy a maximum word budget (taking the most recent messages).
   * This guarantees we do not exceed LLM context window limits while preserving recent context.
   */
  function sliceRecentMessages(messages, maxWords = 3000) {
    if (!messages || messages.length === 0) {
      return {
        slicedMessages: [],
        totalWords: 0,
        slicedWords: 0,
        isTruncated: false,
        totalOriginalMessages: 0,
        slicedMessageCount: 0
      };
    }

    let accumulatedWords = 0;
    const selected = [];

    // Traverse from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const count = msg.wordCount || msg.content.trim().split(/\s+/).filter(Boolean).length;

      if (accumulatedWords + count > maxWords && selected.length > 0) {
        break;
      }

      selected.unshift(msg);
      accumulatedWords += count;
    }

    const isTruncated = selected.length < messages.length;

    return {
      slicedMessages: selected,
      totalWords: messages.reduce((acc, m) => acc + (m.wordCount || 0), 0),
      slicedWords: accumulatedWords,
      isTruncated: isTruncated,
      totalOriginalMessages: messages.length,
      slicedMessageCount: selected.length
    };
  }

  /**
   * Formats parsed messages into a compact, token-efficient transcript for LLM digestion.
   * Format:
   * [Timestamp] Sender: Message content
   */
  function formatForLLM(messages, options = { includeTimestamps: true }) {
    if (!messages || messages.length === 0) return '';

    return messages
      .map(m => {
        if (options.includeTimestamps && m.timestamp) {
          return `[${m.timestamp}] ${m.sender}: ${m.content}`;
        }
        return `${m.sender}: ${m.content}`;
      })
      .join('\n');
  }

  /**
   * Searches parsed messages to locate ground-truth references.
   * Can search by exact timestamp, quote substring, or keyword relevance.
   */
  function findMatchingMessages(criteria, messages) {
    if (!messages || messages.length === 0) return [];
    if (!criteria) return messages.map(m => ({ message: m, score: 1, matchReason: 'All' }));

    let targetTimestamp = '';
    let targetQuote = '';
    let targetSender = '';
    let textQuery = '';

    if (typeof criteria === 'string') {
      textQuery = criteria.trim().toLowerCase();
    } else if (typeof criteria === 'object') {
      targetTimestamp = (criteria.timestamp || '').trim();
      targetQuote = (criteria.quote || criteria.sourceQuote || '').trim().toLowerCase();
      targetSender = (criteria.sender || criteria.from || criteria.person || '').trim().toLowerCase();
      textQuery = (criteria.query || '').trim().toLowerCase();
    }

    const scored = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      let score = 0;
      let matchReason = '';

      const msgContentLower = msg.content.toLowerCase();
      const msgSenderLower = msg.sender.toLowerCase();
      const msgTimestamp = msg.timestamp || '';

      // 1. Exact or partial timestamp match
      if (targetTimestamp && msgTimestamp.includes(targetTimestamp)) {
        score += 100;
        matchReason = 'Timestamp match';
      }

      // 2. Exact quote match
      if (targetQuote && targetQuote.length > 4) {
        if (msgContentLower.includes(targetQuote)) {
          score += 150;
          matchReason = 'Quote match';
        } else {
          // Check words overlap
          const quoteWords = targetQuote.split(/\s+/).filter(w => w.length > 3);
          let matchCount = 0;
          quoteWords.forEach(w => {
            if (msgContentLower.includes(w)) matchCount++;
          });
          if (quoteWords.length > 0 && matchCount / quoteWords.length >= 0.5) {
            score += 50 * (matchCount / quoteWords.length);
            if (!matchReason) matchReason = 'Keyword overlap';
          }
        }
      }

      // 3. Sender alignment
      if (targetSender && (msgSenderLower.includes(targetSender) || targetSender.includes(msgSenderLower))) {
        score += 20;
      }

      // 4. General free-text query
      if (textQuery) {
        if (msgContentLower.includes(textQuery)) {
          score += 80;
          if (!matchReason) matchReason = 'Text match';
        } else if (msgSenderLower.includes(textQuery)) {
          score += 60;
          if (!matchReason) matchReason = 'Sender match';
        } else if (msgTimestamp.toLowerCase().includes(textQuery)) {
          score += 90;
          if (!matchReason) matchReason = 'Timestamp match';
        }
      }

      if (score > 0) {
        scored.push({
          message: msg,
          score,
          matchReason
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // Export to window namespace
  window.WhatsAppParser = {
    cleanInvisibleChars,
    parseWhatsAppChat,
    sliceRecentMessages,
    formatForLLM,
    findMatchingMessages
  };
})(window);
