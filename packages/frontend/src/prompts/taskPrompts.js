export const DEFAULT_SYSTEM_PROMPT =
  'You are a task extraction assistant. Extract and return tasks in the specified JSON format.'

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
