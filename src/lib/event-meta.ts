// Visningsmetadata för varje eventtyp: etikett, emoji och färg ur palettens CSS-variabler
import type { Enums } from '@/types/database'

export type EventType = Enums<'event_type'>

export const EVENT_META: Record<
  EventType,
  { label: string; emoji: string; color: string }
> = {
  match: { label: 'Match', emoji: '⚽', color: 'var(--grass)' },
  mat: { label: 'Mat', emoji: '🍴', color: 'var(--coral)' },
  somn: { label: 'Sömn', emoji: '😴', color: 'var(--lilac)' },
  hygien: { label: 'Hygien', emoji: '🪥', color: 'var(--sky)' },
  samling: { label: 'Samling', emoji: '📣', color: 'var(--sun)' },
  ovrigt: { label: 'Övrigt', emoji: '📌', color: 'var(--rose)' },
}
