/** The message sent by Share and WhatsApp from the "I'm going" card. */
export function goingShareMessage(input: {
  title: string;
  when: string;
  venue?: string | null;
}): string {
  const lines = [`I'm going to ${input.title.trim()}!`, "", input.when.trim()];
  const venue = input.venue?.trim();
  if (venue) lines.push(venue);
  lines.push("", "Are you joining?");
  return lines.join("\n");
}
