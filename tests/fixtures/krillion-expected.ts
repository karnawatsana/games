import type { KrillionExtraction } from "@/lib/krillion/schema";

// Ground truth read by eye from tests/fixtures/krillion-screenshot.png (the player's own block, not the rows above it).
export const KRILLION_FIXTURE: KrillionExtraction = {
  game: "krillion",
  playerHandle: "@sanakarnawat",
  totalScore: 310,
  gameDate: null,
  gameId: null,
  multiplePlayersVisible: true,
  notes: null,
  answers: [
    { questionNumber: 1, questionText: "NAME A TV SHOW THAT'S RATED 8.5+ ON IMDB (1,000+ VOTES)", answerText: "Severance", points: 30, rarityIndicator: null, uncertain: false },
    { questionNumber: 2, questionText: "NAME A CURRENT NBA PLAYER", answerText: "OG Anunoby", points: 60, rarityIndicator: null, uncertain: false },
    { questionNumber: 3, questionText: "NAME A FOOD YOU HAVE TO SHELL OR CRACK OPEN BEFORE EATING", answerText: "Pistachio", points: 10, rarityIndicator: null, uncertain: false },
    { questionNumber: 4, questionText: "NAME A VEHICLE THAT DOESN'T TRAVEL ON WHEELS", answerText: "Submarine", points: 30, rarityIndicator: null, uncertain: false },
    { questionNumber: 5, questionText: "NAME A BODY PART PEOPLE HAVE EXACTLY ONE OF (LIKE THE NOSE)", answerText: "Vulva", points: 60, rarityIndicator: null, uncertain: false },
    { questionNumber: 6, questionText: "NAME A COUNTRY THAT BORDERS GREECE OR AUSTRIA", answerText: "Albania", points: 60, rarityIndicator: null, uncertain: false },
    { questionNumber: 7, questionText: "NAME AN EXTRA THAT AIRLINES CHARGE FOR", answerText: "Sports equipment", points: 60, rarityIndicator: null, uncertain: false },
  ],
};
