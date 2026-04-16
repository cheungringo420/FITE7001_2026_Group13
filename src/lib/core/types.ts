/**
 * Shared core domain types.
 */

export interface MatchFeedbackEvent {
  id: string;
  polymarketId: string;
  kalshiId: string;
  status: 'match' | 'mismatch';
  votes: {
    match: number;
    mismatch: number;
  };
  reason?: string;
  createdAt: string;
  updatedAt: string;
}
