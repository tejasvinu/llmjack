import { v4 as uuidv4 } from 'uuid';
import { Card, Suit, CardValue, Player } from '../types/blackjack';

// Create a new deck of cards
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = Object.values(Suit);
  const values = Object.values(CardValue);

  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        suit,
        value,
        faceUp: true,
        id: uuidv4(), // Add unique ID for animations
      });
    }
  }

  return shuffleDeck(deck);
};

// Shuffle the deck using Fisher-Yates algorithm
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Draw a card from the deck
export const drawCard = (deck: Card[], faceUp: boolean = true): [Card, Card[]] => {
  if (deck.length === 0) {
    // Create a new deck if we run out of cards
    const newDeck = createDeck();
    const card = { ...newDeck.pop()!, faceUp, id: uuidv4() };
    return [card, newDeck];
  }
  
  const newDeck = [...deck];
  const card = { ...newDeck.pop()!, faceUp, id: uuidv4() };
  
  return [card, newDeck];
};

// Get the value of a card
export const getCardValue = (card: Card): number[] => {
  const { value } = card;
  
  switch (value) {
    case CardValue.Ace:
      return [1, 11];
    case CardValue.Two:
      return [2];
    case CardValue.Three:
      return [3];
    case CardValue.Four:
      return [4];
    case CardValue.Five:
      return [5];
    case CardValue.Six:
      return [6];
    case CardValue.Seven:
      return [7];
    case CardValue.Eight:
      return [8];
    case CardValue.Nine:
      return [9];
    case CardValue.Ten:
    case CardValue.Jack:
    case CardValue.Queen:
    case CardValue.King:
      return [10];
    default:
      return [0];
  }
};

// Calculate the score of a hand, handling aces appropriately
export const calculateScore = (hand: Card[]): number => {
  let score = 0;
  let aces = 0;

  // Count aces and sum up non-ace cards
  hand.forEach(card => {
    if (!card.faceUp) return;
    
    const values = getCardValue(card);
    if (card.value === CardValue.Ace) {
      aces++;
    } else {
      score += values[0];
    }
  });

  // Add aces with optimal values
  if (aces > 0) {
    // For each ace, decide if it should be 1 or 11
    for (let i = 0; i < aces; i++) {
      if (score + 11 <= 21) {
        score += 11;
      } else {
        score += 1;
      }
    }
  }

  return score;
};

// Check if a hand is a blackjack (21 with 2 cards)
export const isBlackjack = (hand: Card[]): boolean => {
  return hand.length === 2 && calculateScore(hand) === 21;
};

// Check if a hand has busted (score > 21)
export const hasBusted = (hand: Card[]): boolean => {
  return calculateScore(hand) > 21;
};

// Dealer's turn (draws until score is at least 17)
export const dealerPlay = (dealer: Omit<Player, 'chips' | 'bet'>, deck: Card[]): { dealer: Omit<Player, 'chips' | 'bet'>, deck: Card[] } => {
  let newDealer = { 
    ...dealer,
    hand: dealer.hand.map(card => ({ ...card, faceUp: true }))
  };
  
  let newDeck = [...deck];
  
  // Reveal the dealer's face-down card
  newDealer.score = calculateScore(newDealer.hand);
  
  // Draw cards until score is at least 17
  while (newDealer.score < 17) {
    let card: Card;
    [card, newDeck] = drawCard(newDeck, true);
    newDealer.hand.push(card);
    newDealer.score = calculateScore(newDealer.hand);
  }
  
  newDealer.hasBusted = hasBusted(newDealer.hand);
  newDealer.hasBlackjack = isBlackjack(newDealer.hand);
  
  return { dealer: newDealer, deck: newDeck };
};

// Determine the winner and return result message
export const determineWinner = (player: Player, dealer: Omit<Player, 'chips' | 'bet'>): string => {
  if (player.hasBlackjack && !dealer.hasBlackjack) {
    return "Blackjack! You win!";
  }
  
  if (!player.hasBlackjack && dealer.hasBlackjack) {
    return "Dealer has blackjack. You lose!";
  }
  
  if (player.hasBlackjack && dealer.hasBlackjack) {
    return "Both have blackjack. It's a push!";
  }
  
  if (player.hasBusted) {
    return "Bust! You lose!";
  }
  
  if (dealer.hasBusted) {
    return "Dealer busts! You win!";
  }
  
  if (player.score > dealer.score) {
    return "You win!";
  }
  
  if (player.score < dealer.score) {
    return "Dealer wins!";
  }
  
  return "It's a push!";
};
