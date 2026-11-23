export function financeAlertText(message: string): { body: string; reference: string | null } {
  const match = /^\s*(\[TUITION_REMINDER:[^\]\r\n]{1,240}:DATE:\d{4}-\d{2}-\d{2}\])\s*/.exec(message);
  if (!match) return { body: message, reference: null };
  const body = message.slice(match[0].length).trim();
  return body ? { body, reference: match[1] } : { body: message, reference: null };
}
