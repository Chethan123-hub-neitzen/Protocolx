# Chat Summarizer — LLM Prompt Specification & Architecture

This document contains the complete prompt engineering architecture, system prompt templates, output schema definitions, and token optimization rules used by the **Chat Summarizer** engine (Protocol X).

---

## 1. Executive Summary & Prompt Philosophy

The goal of the Chat Summarizer prompt is to transform messy, unstructured multi-participant chat exports (e.g., WhatsApp, Telegram, Slack exports) into high-fidelity, actionable executive intelligence.

### Key Prompt Tenets:
1. **Strict Determinism**: Zero hallucinations. Every claim, decision, and action item must be grounded directly in the provided text.
2. **Ground-Truth Source Verification**: Every extracted decision, task, @mention, and deadline includes its exact timestamp and a verbatim source quote, enabling 1-click highlighting and auditing in the raw conversation transcript.
3. **Structured JSON Output**: The LLM must output clean, parseable JSON strictly adhering to the schema, suitable for programmatic UI rendering without regex parsing failures.
4. **Signal-to-Noise Filtering**: Eliminate conversational filler, pleasantries, media notices (`<Media omitted>`), and system security banners.

---

## 2. System Prompt Template

```markdown
You are an elite executive communications assistant and expert chat analyst.
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
      "timestamp": "Exact timestamp from the chat message when this was decided (e.g., '15/01/2025, 09:43')",
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
5. Ensure the JSON is completely valid and parseable.
```

---

## 3. User Prompt Format

```markdown
Here is the chat transcript to analyze:

---
{{FORMATTED_CHAT_TEXT}}
---
```

### Context Boundary Rules:
- The triple-dash `---` boundary encapsulates untrusted chat text to defend against prompt injection inside conversation messages.
- The `{{FORMATTED_CHAT_TEXT}}` contains the normalized output of the local parsing engine, where timestamps and sender headers have been validated and non-text system noise has been pruned.

---

## 4. Ground-Truth Source Verification Specification

To allow the user to confirm any summary line, the prompt requires two auditing anchors for every extracted item:

| Field | Purpose | Client-side UI Behavior |
| :--- | :--- | :--- |
| `timestamp` | Exact timestamp string as formatted in the raw chat | Triggers transcript filter/scroll directly to the sender's message box |
| `sourceQuote` | Exact substring (3–15 words) from the message | Highlighted with `<mark class="bg-amber-300">` and pulse animation in the transcript modal |

### Client-Side Matching Algorithm:
```javascript
// Step 1: Locate message by exact timestamp and sender
const candidate = messages.find(m => m.timestamp === item.timestamp);

// Step 2: Fallback to fuzzy keyword search if timestamp had minor formatting variance
if (!candidate && item.sourceQuote) {
  const matches = findMatchingMessages(messages, item.sourceQuote);
}
```

---

## 5. Token Preprocessing & Context Slicing Strategy

Before passing the chat transcript to the LLM:
1. **Unicode Sanitization**: Strips bidirectional overrides (`\u200e`, `\u200f`), zero-width spaces (`\u200b`), and non-breaking spaces.
2. **Noise Removal**: Excludes standard platform notification lines:
   - *"Messages and calls are end-to-end encrypted."*
   - *"image omitted"*, *"audio omitted"*, *"sticker omitted"*, *"GIF omitted"*.
3. **Word Budget Slicing**:
   - Default budget: **12,000 words** (~16,000 tokens).
   - If transcript exceeds the budget, the slicer retains the **most recent** messages (slicing from the tail) while preserving chronological order, ensuring the latest decisions and immediate deadlines take priority.

---

## 6. Few-Shot Demonstration

### Input Conversation Snippet:
```text
15/01/2025, 09:35 - Alex (Tech Lead): Morning everyone. We had a blocker late last night with the payment gateway webhooks.
15/01/2025, 09:43 - Alex (Tech Lead): DECISION: We are not pushing back the Friday release date. We will bypass the legacy discount microservice and upgrade directly to Stripe API v3.
15/01/2025, 09:48 - Alex (Tech Lead): @David please flush the Redis cache namespace and allocate 8GB memory to the staging cluster before 2:00 PM today.
15/01/2025, 09:50 - David (DevOps Lead): On it @Alex! I will run the memory upgrade and notify everyone in this chat by 1:30 PM.
15/01/2025, 10:05 - Sarah (Product Manager): @Elena please run the complete automated regression suite on staging build #512 as soon as Priya's PR gets merged, ideally starting by 4:00 PM today.
```

### Generated JSON Response:
```json
{
  "title": "Alpha Sprint Stripe Blocker Resolution & Release Deadlines",
  "chatOverview": {
    "highLevelSummary": "The engineering team resolved a critical payment webhook blocker by agreeing to bypass the legacy discount service in favor of Stripe API v3. The team established a rapid sequence of caching, PR submission, and QA tasks to preserve the scheduled Friday 6:00 PM release date.",
    "toneAndVibe": "Urgent, High-Speed & Decisive",
    "keyMetrics": {
      "mainTopic": "Payment Gateway Hotfix & Sprint Sign-off",
      "timeframe": "Today (Deployment Friday 6:00 PM)"
    }
  },
  "importantDecisions": [
    {
      "decision": "Bypass legacy discount microservice and upgrade directly to Stripe API v3 without delaying Friday release",
      "priority": "Urgent",
      "decidedBy": "Alex (Tech Lead)",
      "rationale": "Prevents postponing the Friday 6:00 PM release and resolves the 422 webhook failures",
      "timestamp": "15/01/2025, 09:43",
      "sourceQuote": "DECISION: We are not pushing back the Friday release date. We will bypass the legacy discount microservice"
    }
  ],
  "actionItems": [
    {
      "task": "Flush Redis cache namespace and allocate 8GB RAM to staging cluster",
      "assignee": "David (DevOps Lead)",
      "deadline": "Today by 1:30 PM",
      "urgency": "Urgent",
      "timestamp": "15/01/2025, 09:48",
      "sourceQuote": "@David please flush the Redis cache namespace and allocate 8GB memory"
    },
    {
      "task": "Execute full automated regression test suite on staging build #512",
      "assignee": "Elena (QA Lead)",
      "deadline": "Today starting by 4:00 PM (Target sign-off 6:30 PM)",
      "urgency": "High",
      "timestamp": "15/01/2025, 10:05",
      "sourceQuote": "@Elena please run the complete automated regression suite on staging build #512"
    }
  ],
  "highlightedMentions": [
    {
      "person": "@David",
      "context": "Assigned Redis cache flush and memory upgrade before 2:00 PM",
      "from": "Alex (Tech Lead)",
      "timestamp": "15/01/2025, 09:48",
      "sourceQuote": "@David please flush the Redis cache namespace"
    },
    {
      "person": "@Elena",
      "context": "Requested to run automated regression suite once PR merges",
      "from": "Sarah (Product Manager)",
      "timestamp": "15/01/2025, 10:05",
      "sourceQuote": "@Elena please run the complete automated regression suite"
    }
  ],
  "deadlinesSummary": [
    {
      "event": "Redis staging upgrade",
      "dateOrTime": "Today at 1:30 PM",
      "status": "Immediate",
      "timestamp": "15/01/2025, 09:50",
      "sourceQuote": "notify everyone in this chat by 1:30 PM"
    },
    {
      "event": "Automated regression testing start",
      "dateOrTime": "Today at 4:00 PM",
      "status": "Upcoming",
      "timestamp": "15/01/2025, 10:05",
      "sourceQuote": "ideally starting by 4:00 PM today"
    }
  ]
}
```

---

## 7. Recommended Inference Parameters

When calling the Groq / OpenAI compatible API endpoint:

| Parameter | Recommended Value | Rationale |
| :--- | :--- | :--- |
| `temperature` | `0.1` – `0.2` | Minimizes creative hallucination; maximizes factual accuracy. |
| `response_format` | `{ "type": "json_object" }` | Enforces native JSON syntax generation at the tokenizer level. |
| `top_p` | `0.9` | Constrains token selection to high-probability factual tokens. |
| `max_tokens` | `4096` | Accommodates lengthy summaries with dozens of tasks and decisions. |

---

## 8. Robustness & Fallback Handling

1. **Markdown Fencing Stripper**: If the LLM wraps output in ` ```json ... ``` `, the parser strips backticks before JSON parsing.
2. **Sub-string Brace Slicing**: If preamble text accidentally precedes or follows the JSON, the parser slices from `firstIndexOf('{')` to `lastIndexOf('}')`.
3. **Model Auto-Fallback Cascade**: If the selected model encounters rate limits or deprecation (404/400), the client automatically tries fallback models (`llama-3.3-70b-versatile` -> `llama-3.1-8b-instant`).
4. **Offline Heuristic Mode**: If network connectivity is lost, the client-side rule engine parses regex keywords (`DECISION:`, `@User`, `by [Time]`) to provide zero-latency summaries locally.
