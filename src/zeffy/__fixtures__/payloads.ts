import type { ZeffyPayload } from '../types';

// Synthetic sample #1 (Kareem Ali — all four categories).
export const PAYLOAD_ALL_CATS: ZeffyPayload = {
  id: 'e1000000-0000-4000-8000-000000000001',
  type: 'payment.completed',
  data: {
    id: 'a1000000-0000-4000-8000-000000000001',
    status: 'succeeded',
    campaign_id: 'c0000000-0000-4000-8000-000000000000',
    buyer: { email: 'buyer@example.com', first_name: 'Sample', last_name: 'Buyer' },
    items: [
      {
        id: 'a1000000-0000-4000-8000-0000000000a1',
        type: 'ticket',
        questions: [
          { question: 'Contestant FULL Name', type: 'text', answer: 'Kareem Ali' },
          { question: 'Contestant Date of Birth', type: 'date', answer: '2005-03-12' },
          { question: 'Gender', type: 'single_select', answer: 'Male' },
          { question: 'Categories', type: 'multi_select', answer: ['1 Juz (Ages 13 and Under)', '5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
        ],
      },
    ],
  },
};

// Synthetic sample #2 (Yusuf Karim — three categories; the retry-tested payload).
export const PAYLOAD_THREE_CATS: ZeffyPayload = {
  id: 'e2000000-0000-4000-8000-000000000002',
  type: 'payment.completed',
  data: {
    id: 'b2000000-0000-4000-8000-000000000002',
    status: 'succeeded',
    campaign_id: 'c0000000-0000-4000-8000-000000000000',
    buyer: { email: 'buyer@example.com', first_name: 'Sample', last_name: 'Buyer' },
    items: [
      {
        id: 'b2000000-0000-4000-8000-0000000000b2',
        type: 'ticket',
        questions: [
          { question: 'Contestant FULL Name', type: 'text', answer: 'Yusuf Karim' },
          { question: 'Contestant Date of Birth', type: 'date', answer: '2008-06-20' },
          { question: 'Gender', type: 'single_select', answer: 'Male' },
          { question: 'Categories', type: 'multi_select', answer: ['5 Juz (Ages 20 and Under)', '15 Juz (Ages 27 and Under)', '30 Juz (Ages 35 and Under)'] },
        ],
      },
    ],
  },
};
