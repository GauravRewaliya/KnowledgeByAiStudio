# Known Issues & Architectural Fixes

## 1. Sandbox Limitations: `window.confirm` and `window.alert`
**Issue:**
When the application runs within a restricted `iframe` (common in preview environments or security sandboxes) without the `allow-modals` permission, calls to `window.confirm()` or `window.alert()` are ignored or throw errors.

**Error Message:**
> "Ignored call to 'confirm()'. The document is sandboxed, and the 'allow-modals' keyword is not set."

**Fix:**
Do not use native browser dialogs. Instead, implement custom React modal components overlaid on the UI.
- **Component:** `components/ConfirmModal.tsx`
- **Usage:** Maintain local state in the parent component to control the modal's visibility and the callback function to execute upon confirmation.

**Files Affected:**
- `components/ProjectManager.tsx` (Project deletion, Demo import)
- `components/BrowserPanel.tsx` (Session deletion)
- `components/HarViewer.tsx` (Entry deletion - already handled via custom modal)

---

## 2. Large HAR File Processing
**Issue:**
Parsing very large JSON files on the main thread freezes the UI.
**Fix:** 
(Pending) Move parsing logic to a Web Worker. Currently mitigated by truncating content in previews and AI contexts.

## 3. Recursive JSON Structures
**Issue:** 
Deeply nested JSON can cause stack overflows or rendering lag.
**Fix:**
`JsonViewer` component uses recursive rendering but limits initial expansion depth. `summarizeJsonStructure` utility prevents sending massive objects to the AI agent.
