// Card suits
export enum Suit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades',
}

// Card values
export enum CardValue {
  Ace = 'A',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
}

// Card representation
export interface Card {
  suit: Suit;
  value: CardValue;
  faceUp: boolean;
  id?: string; // Unique ID for animation purposes
}

// Player types
export enum PlayerType {
  HUMAN = 'human',
  AI = 'ai',
}

// AI Model options (using specific model IDs)
// Ensure these model IDs are supported by the respective providers (Google AI SDK, Groq AI SDK)
export enum AIModel {
  GEMINI_1_5_FLASH = 'gemini-1.5-flash-latest', // Google Model
  LLAMA3_70B = 'llama3-70b-8192',             // Groq Model
  LLAMA3_8B = 'llama3-8b-8192',               // Groq Model (Smaller)
  // Add more models here if needed, clearly indicating the provider if ambiguous
}

// Player interface
export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  hasBusted: boolean;
  hasBlackjack: boolean;
  hasStood: boolean;
  chips: number;
  bet: number;
  isActive: boolean;
  playerType?: PlayerType; // Whether the player is human or AI
  aiModel?: AIModel; // Specific model for AI player
  resultMessage?: string; // Individual result message
}

// Game phase to track current state
export enum GamePhase {
  BETTING = 'betting',
  PLAYER_TURNS = 'player_turns',
  DEALER_TURN = 'dealer_turn',
  GAME_OVER = 'game_over',
}

// Game state
export interface GameState {
  deck: Card[];
  players: Player[];
  dealer: Omit<Player, 'chips' | 'bet'>;
  currentPlayerIndex: number;
  isGameOver: boolean;
  message: string;
  isPlayerTurn: boolean;
  round: number;
  gamePhase: GamePhase; // Add game phase to track state
  aiIsThinking: { playerId: string | null; action: 'betting' | 'playing' | null }; // For AI "thinking" indicator
}

// Action types
export enum GameActionType {
  SET_AI_THINKING = 'set_ai_thinking',
  CLEAR_AI_THINKING = 'clear_ai_thinking',
  UPDATE_MESSAGE = 'update_message', // New action for updating game message
  DEAL = 'deal',
  HIT = 'hit',
  STAND = 'stand',
  RESET = 'reset',
  ADD_PLAYER = 'add_player',
  REMOVE_PLAYER = 'remove_player',
  PLACE_BET = 'place_bet',
  NEXT_PLAYER = 'next_player',
  START_BETTING_PHASE = 'start_betting_phase', // New action
  PROCESS_DEALER_TURN = 'process_dealer_turn', // Process dealer's turn
  ADD_AI_PLAYER = 'add_ai_player', // Add AI player
  TOGGLE_PLAYER_TYPE = 'toggle_player_type', // Toggle between AI and human
}

// Game actions
export type GameAction =
  | { type: GameActionType.SET_AI_THINKING, payload: { playerId: string, action: 'betting' | 'playing' } }
  | { type: GameActionType.CLEAR_AI_THINKING }
  | { type: GameActionType.UPDATE_MESSAGE, payload: { message: string, type?: 'info' | 'warning' | 'error' } } // Define payload
  | { type: GameActionType.DEAL }
  | { type: GameActionType.HIT }
  | { type: GameActionType.STAND }
  | { type: GameActionType.RESET }
  | { type: GameActionType.ADD_PLAYER, payload: { name: string } }
  | { type: GameActionType.REMOVE_PLAYER, payload: { id: string } }
  | { type: GameActionType.PLACE_BET, payload: { playerId: string, amount: number } }
  | { type: GameActionType.NEXT_PLAYER }
  | { type: GameActionType.START_BETTING_PHASE }
  | { type: GameActionType.PROCESS_DEALER_TURN, payload: { players: Player[], dealer: any, deck: Card[] } }
  | { type: GameActionType.ADD_AI_PLAYER, payload: { model: AIModel } } // Use model instead of strategy
  | { type: GameActionType.TOGGLE_PLAYER_TYPE, payload: { playerId: string, playerType: PlayerType, model?: AIModel } }; // Use model instead of strategy
