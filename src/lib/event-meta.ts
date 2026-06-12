// Visningsmetadata för varje eventtyp: etikett, emoji och färg ur palettens CSS-variabler
import type { Enums } from '@/types/database'

export type EventType = Enums<'event_type'>

// Dämpade toner som harmonierar med klubbens mörkgröna/créme/guld
export const EVENT_META: Record<
  EventType,
  { label: string; emoji: string; color: string }
> = {
  match: { label: 'Match', emoji: '⚽', color: 'var(--grass)' },
  mat: { label: 'Mat', emoji: '🍴', color: 'var(--ochre)' },
  somn: { label: 'Sömn', emoji: '😴', color: 'var(--petrol)' },
  hygien: { label: 'Hygien', emoji: '🪥', color: 'var(--sage)' },
  samling: { label: 'Samling', emoji: '📣', color: 'var(--sun)' },
  ovrigt: { label: 'Övrigt', emoji: '📌', color: 'var(--falu)' },
}
