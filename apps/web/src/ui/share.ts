import { toast } from './components.ts';

/** The game's own address, without any query or hash. */
export function homeUrl(): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  return u.toString();
}

/** A link that drops a friend straight into your room. */
export const inviteUrl = (code: string): string => `${homeUrl()}?room=${code}`;

/** Opens the system share sheet, or copies to the clipboard where there is none. */
export async function shareLink(text: string, url: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Bean Machine', text, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Link copied!');
  } catch {
    toast(url);
  }
}
