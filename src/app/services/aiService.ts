import { Card, Suit, CardValue, Player, AIModel } from '../types/blackjack';

// AI provider selection
export enum AIProvider {
  Google = 'google',
  Groq = 'groq'
}

// Helper function to determine provider based on model ID
export function getProviderForModel(modelId: AIModel): AIProvider {
  // Simple logic: if model ID includes 'gemini', assume Google, otherwise Groq.
  // This might need adjustment if more providers or different model naming conventions are used.
  if (modelId.includes('gemini')) {
    return AIProvider.Google;
  }
  return AIProvider.Groq;
}

// Format a player's hand for AI prompt
function formatHand(hand: Card[]): string {
  return hand
    .filter(card => card.faceUp)
    .map(card => `${card.value}${getSuitSymbol(card.suit)}`)
    .join(', ');
}

// Helper function to get suit symbols
function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts: return '♥';
    case Suit.Diamonds: return '♦';
    case Suit.Clubs: return '♣';
    case Suit.Spades: return '♠';
    default: return '';
  }
}

// Formats the game state into a text representation for the AI
function formatGameStateForAI(
  playerHand: Card[],
  playerScore: number,
  dealerUpCard: Card | null,
  players: Player[],
  isBasicStrategy: boolean = false
): string {
  let prompt = '';
  
  if (isBasicStrategy) {
    // For basic strategy, we just need player hand and dealer's up card
    prompt = `You have: ${formatHand(playerHand)} (score: ${playerScore}).\n`;
    prompt += dealerUpCard ? `Dealer shows: ${dealerUpCard.value}${getSuitSymbol(dealerUpCard.suit)}.\n` : 'Dealer has no cards yet.\n';
    prompt += 'Based on basic blackjack strategy, should I hit or stand?';
  } else {
    // For more advanced strategic thinking
    prompt = `You are playing blackjack. Your hand: ${formatHand(playerHand)} (score: ${playerScore}).\n`;
    prompt += dealerUpCard ? `Dealer shows: ${dealerUpCard.value}${getSuitSymbol(dealerUpCard.suit)}.\n` : 'Dealer has no cards yet.\n';
    
    // Add information about other players at the table
    if (players.length > 1) {
      prompt += 'Other players at the table:\n';
      players.forEach(player => {
        if (player.hand.length > 0 && player.hand.some(card => card.faceUp)) {
          prompt += `- ${player.name}: ${formatHand(player.hand)} (visible score: ${calculateVisibleScore(player.hand)})\n`;
        }
      });
    }
    
    prompt += 'Based on this situation, would you hit or stand? Explain your reasoning briefly, then answer with just "HIT" or "STAND".';
  }
  
  return prompt;
}

// Calculate the score of only visible cards
function calculateVisibleScore(hand: Card[]): number {
  const visibleCards = hand.filter(card => card.faceUp);
  
  let score = 0;
  let aces = 0;
  
  for (const card of visibleCards) {
    if (card.value === CardValue.Ace) {
      aces += 1;
      score += 11;
    } else if ([CardValue.King, CardValue.Queen, CardValue.Jack].includes(card.value)) {
      score += 10;
    } else {
      score += parseInt(card.value);
    }
  }
  
  // Adjust for aces if needed
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  
  return score;
}

// Get AI betting decision
export async function getAIBetDecision(
  playerChips: number,
  modelId: AIModel = AIModel.LLAMA3_8B // Default to a Groq model for betting for speed
): Promise<number> {
  const prompt = `You're playing blackjack and have ${playerChips} chips.
  What's a reasonable bet amount? Consider standard betting strategies.
  Respond with ONLY a number between 10 and ${Math.min(playerChips, 500)}, with no explanation.`;

  const provider = getProviderForModel(modelId); // Determine provider

  try {
    // Use API route instead of direct SDK call
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        provider: provider, // Send determined provider
        model: modelId      // Send the specific model ID
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Attempt to parse JSON, default to empty object on failure
      console.error(
        `AI Bet Decision Error - Status: ${response.status}, StatusText: ${response.statusText}, Provider: ${provider}, Model: ${modelId}, ResponseBody: ${JSON.stringify(errorData)}`
      );
      throw new Error(`AI bet decision request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Enhanced parsing for bet amount
    const betText = data.text?.trim().replace(/[^0-9]/g, '') || '';
    const bet = parseInt(betText);

    if (isNaN(bet) || bet <= 0) {
      console.warn(`AI (${modelId}) provided invalid bet: "${data.text}". Using fallback.`);
      const fallbackBet = Math.max(10, Math.min(Math.floor(playerChips * 0.05), 100));
      return Math.min(fallbackBet, playerChips);
    }
    
    // Ensure bet is within valid range
    const validBet = Math.min(Math.max(10, bet), playerChips, 500);
    return validBet;
  } catch (error) {
    console.error(`Error in getAIBetDecision for model ${modelId}:`, error instanceof Error ? error.message : error);
    // Fallback bet logic
    const fallbackBet = Math.max(10, Math.min(Math.floor(playerChips * 0.05), 100));
    return Math.min(fallbackBet, playerChips); // Ensure fallback doesn't exceed chips
  }
}

// Get AI player's decision to hit or stand
export async function getAIDecision(
  playerHand: Card[],
  playerScore: number,
  dealerUpCard: Card | null,
  players: Player[],
  modelId: AIModel // Use the specific model ID passed from the player
): Promise<'HIT' | 'STAND'> {
  // Always use the detailed prompt now
  const prompt = formatGameStateForAI(playerHand, playerScore, dealerUpCard, players);
  const provider = getProviderForModel(modelId); // Determine provider

  try {
    // Use API route instead of direct SDK call
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        provider: provider, // Send determined provider
        model: modelId      // Send the specific model ID
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Attempt to parse JSON, default to empty object on failure
      const errorMessage = errorData?.error || 'Unknown error';
      console.error(
        `AI Decision Error - Status: ${response.status}, StatusText: ${response.statusText}, Provider: ${provider}, Model: ${modelId}, ResponseBody: ${JSON.stringify(errorData)}`
      );
      throw new Error(`AI decision request failed: ${response.status} ${response.statusText} - ${errorMessage}`);
    }

    const data = await response.json();
    const decisionText = data.text?.toUpperCase() || '';

    // More robust decision parsing
    let decision: 'HIT' | 'STAND';
    if (decisionText.includes('HIT')) {
      decision = 'HIT';
    } else if (decisionText.includes('STAND')) {
      decision = 'STAND';
    } else {
      console.warn(`AI (${modelId}) provided ambiguous decision: "${data.text}". Defaulting to STAND.`);
      decision = 'STAND'; // Default to STAND if neither is clearly found
    }
    
    console.log(`AI (${modelId}) decision: ${decision} (Raw: "${data.text?.substring(0,100) || ''}...")`);
    return decision;
  } catch (error) {
    console.error(`Error in getAIDecision for model ${modelId}:`, error instanceof Error ? error.message : error);
    // Fallback to basic strategy
    return playerScore < 17 ? 'HIT' : 'STAND';
  }
}
