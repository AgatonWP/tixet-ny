/**
 * Unsent message drafts, kept per chat for as long as the app is running.
 *
 * Opening a chat you never finished writing in restores what you typed, while a
 * different chat always starts with an empty input.
 *
 * A chat is keyed by its conversation id, but the modal can open before that id
 * exists (the conversation is created on demand from a listing). Those chats
 * start on a provisional listing key that is linked to the real conversation id
 * once it loads, so the draft follows along.
 */
const drafts = new Map<string, string>();
const canonicalKeys = new Map<string, string>();

function resolveKey(key: string) {
  return canonicalKeys.get(key) ?? key;
}

export function readDraft(key: string) {
  return drafts.get(resolveKey(key)) ?? '';
}

export function saveDraft(key: string, value: string) {
  const resolved = resolveKey(key);
  if (value) {
    drafts.set(resolved, value);
  } else {
    drafts.delete(resolved);
  }
}

export function clearDraft(key: string) {
  drafts.delete(resolveKey(key));
}

/** Points a provisional key at the conversation id, moving any draft with it. */
export function linkDraftKey(key: string, conversationId: string) {
  if (key === conversationId) return;

  const pending = drafts.get(key);
  canonicalKeys.set(key, conversationId);
  drafts.delete(key);
  if (pending) drafts.set(conversationId, pending);
}
