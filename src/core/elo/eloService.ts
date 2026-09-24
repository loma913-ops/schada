export interface PlayerEloData {
  rating: number;
  gamesPlayed: number;
}

export interface EloCalculationResult {
  blueDelta: number;
  greenDelta: number;
  newBlueRating: number;
  newGreenRating: number;
}

export function getKFactor(gamesPlayed: number): number {
  return gamesPlayed < 15 ? 40 : 20;
}

export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function calculateEloUpdate(
  blue: PlayerEloData,
  green: PlayerEloData,
  outcome: 'blue' | 'green' | 'draw'
): EloCalculationResult {
  const expectedBlue = calculateExpectedScore(blue.rating, green.rating);
  const expectedGreen = calculateExpectedScore(green.rating, blue.rating);

  let actualBlue = 0.5;
  let actualGreen = 0.5;

  if (outcome === 'blue') {
    actualBlue = 1.0;
    actualGreen = 0.0;
  } else if (outcome === 'green') {
    actualBlue = 0.0;
    actualGreen = 1.0;
  }

  const kBlue = getKFactor(blue.gamesPlayed);
  const kGreen = getKFactor(green.gamesPlayed);

  const blueDelta = Math.round(kBlue * (actualBlue - expectedBlue));
  const greenDelta = Math.round(kGreen * (actualGreen - expectedGreen));

  return {
    blueDelta,
    greenDelta,
    newBlueRating: Math.max(100, blue.rating + blueDelta),
    newGreenRating: Math.max(100, green.rating + greenDelta),
  };
}
