import type { Card, Concept } from '../core/types';

/**
 * DEMO İÇERİK: geliştirme için uydurma yer tutucular.
 * Hiçbir tıbbi veya klinik bilgi içermez; gerçek içerik gelince silinecek.
 */
export const demoConcepts: Concept[] = [
  { id: 'demo-a', name: 'Demo kavram A' },
  { id: 'demo-b', name: 'Demo kavram B' },
  { id: 'demo-c', name: 'Demo kavram C' },
];

const LETTERS = ['A', 'B', 'C', 'D'];

function demoCard(conceptId: string, n: number): Card {
  const correctIndex = (n + conceptId.length) % 4;
  return {
    id: `${conceptId}-${n}`,
    conceptIds: [conceptId],
    prompt: `[DEMO] ${conceptId.toUpperCase()} kartı ${n}: Doğru seçenek hangisi?`,
    options: LETTERS.map((l) => `Seçenek ${l}`),
    correctIndex,
    explanation: `[DEMO] Bu bir yer tutucudur. Doğru seçenek ${LETTERS[correctIndex]} olarak belirlenmiştir; gerçek bir açıklama içermez.`,
    source: 'Yer tutucu (tıbbi bilgi içermez)',
    reviewedAt: '2026-10-01',
    status: 'demo',
  };
}

export const demoCards: Card[] = demoConcepts.flatMap((concept) =>
  [1, 2, 3, 4].map((n) => demoCard(concept.id, n)),
);
