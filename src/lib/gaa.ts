import { CLUB_NAME } from './constants';

/**
 * Parse a GAA score string (e.g. "2-14") to its total points equivalent.
 * Formula: goals × 3 + points
 */
export function parseGAAScore(score: string): number {
  const parts = score.split('-');
  if (parts.length === 2) {
    const goals = parseInt(parts[0], 10);
    const points = parseInt(parts[1], 10);
    if (!isNaN(goals) && !isNaN(points)) {
      return goals * 3 + points;
    }
  }
  return parseInt(score, 10) || 0;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export function getOutcome(shamrocksScore: string, opponentScore: string): MatchOutcome {
  const shamrocksTotal = parseGAAScore(shamrocksScore);
  const opponentTotal = parseGAAScore(opponentScore);
  if (shamrocksTotal > opponentTotal) return 'win';
  if (shamrocksTotal < opponentTotal) return 'loss';
  return 'draw';
}

export const OUTCOME_COLORS: Record<MatchOutcome, string> = {
  win: 'bg-green-600',
  loss: 'bg-red-600',
  draw: 'bg-gray-500',
};

export const OUTCOME_LABELS: Record<MatchOutcome, string> = {
  win: 'W',
  loss: 'L',
  draw: 'D',
};

interface MatchResult {
  homeTeam: string;
  awayTeam: string;
  round: string;
}

interface Video {
  opponent: string;
  round: string;
  url: string;
}

export function findVideoUrl(result: MatchResult, videos: Video[]): string | undefined {
  const opponent = result.homeTeam === CLUB_NAME ? result.awayTeam : result.homeTeam;
  const video = videos.find(v => {
    const opponentMatch = v.opponent.toLowerCase() === opponent.toLowerCase() ||
                          opponent.toLowerCase().includes(v.opponent.toLowerCase()) ||
                          v.opponent.toLowerCase().includes(opponent.toLowerCase());
    const roundMatch = v.round.toLowerCase() === result.round.toLowerCase();
    return opponentMatch && roundMatch;
  });
  return video?.url;
}
