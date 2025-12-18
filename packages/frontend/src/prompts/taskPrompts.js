export const DEFAULT_SYSTEM_PROMPT =
  'You are a task extraction assistant. Extract and return tasks in the specified JSON format.'

export const DEFAULT_PROMPT_TEMPLATE = `Extract actionable tasks from this single Slack thread. Return a JSON array matching this schema:

\${schemaDescription}

IMPORTANT:
- Only return tasks that are explicitly supported by the thread text.
- If there is no clear actionable work request, return [].
- If there is an explicit request but key details are missing, you may return an "Investigate X" task,
  but it must still be grounded in the thread text and reuse the thread's nouns/entities.
- Prefer concrete, grounded titles that reuse key nouns from the thread.
- task_title should be as specific as the thread allows (but don't return []
  just because the title can't be perfect).
- task_description MUST be a short narrative summary (1-4 sentences).
  It should summarize what happened in the thread and the intended outcome/next action.
  DO NOT include acceptance-criteria templates, bullet lists, or embedded quotes.

\${examplesCriteria}

Thread (JSON):
\${threadJson}`

export const REQUIRED_GROUNDING_RULES = `NON-NEGOTIABLE RULES:
- Use ONLY the provided conversation/thread text.
- Do NOT use outside knowledge.
- Do NOT invent tasks or context.
- Only return tasks that are explicitly supported by the text.
- If there is no clear actionable work, return [] in the requested JSON format.
`

export const DEFAULT_SYSTEM_MESSAGE_WITH_FORMAT = 'You are a task extraction assistant. Use ONLY the provided text. Do NOT invent tasks. Return tasks strictly in the specified JSON format.'

export const DEFAULT_SYSTEM_MESSAGE_WITHOUT_FORMAT = 'You are a task extraction assistant. Return tasks as a JSON array.'

export const DEFAULT_SYSTEM_MESSAGE = DEFAULT_SYSTEM_MESSAGE_WITH_FORMAT

export const DEFAULT_PROMPT_TEMPLATE_FOR_DB = `Extract ALL actionable tasks from this conversation. Return a JSON array matching this schema:

\${schemaDescription}

Conversation:
\${conversationText}`

export const DEFAULT_EXAMPLES_CRITERIA = `OUTPUT QUALITY (CRITICAL):
- task_title MUST name the specific component/feature/area + the action.
- NEVER use vague titles like "Fix bug", "Update validation logic", "Check issue".
- task_description MUST read like a short thread summary (2-4 sentences).
  It should explain what was discussed and the intended outcome/next action.
  DO NOT include acceptance-criteria templates, bullet lists, or embedded quotes.

EXAMPLES of good specificity (style only — do NOT reuse these topics unless they appear in the input text):
- "date picker doesn't open on click in Tasks filters"
  → {"task_title":"Fix Tasks filters date picker not opening","task_description":"In the Tasks page filters, clicking the date input does not open the calendar, so users cannot select a date range. We should make the date picker open reliably on click and ensure selecting a range updates the filter."}

Look for ANY of these (they ARE tasks):
- Questions: "could you check...", "can you look at...", "would you..."
- Requests: "please fix", "please check"
- Mentions: "@user please do X"
- Bug reports: "X is not working", "there's an issue with X", "X needs to be fixed"
- Status updates: "working on X", "fixing Y", "taking a look"
- Deliverables: "we will deliver X", "planning to finish Y"
- Features: "add feature X", "improve Y", "enhance Z"
- Commitments: "I'll check", "sure, checking it"

DO NOT extract tasks that are only about reviewing a PR / pull request / code review.

CRITICAL: Only extract tasks that are explicitly supported by the conversation/thread text. Return [] when there is no clear actionable work.`
