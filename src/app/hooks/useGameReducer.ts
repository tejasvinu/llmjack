import { useReducer, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  GameAction,
  GameActionType,
  Player,
  GamePhase,
  Suit,
  Card,
  PlayerType,
  AIModel // Changed from AIStrategy
} from '../types/blackjack';
import {
  createDeck,
  calculateScore,
  isBlackjack,
  hasBusted,
  drawCard,
  dealerPlay,
  // determineWinner // Removed determineWinner import as it's not used directly here
} from './useBlackjack';
import { getAIDecision, getAIBetDecision } from '../services/aiService'; // Removed AIProvider import

// Initial player state
const createNewPlayer = (name: string, playerType: PlayerType = PlayerType.HUMAN, aiModel: AIModel = AIModel.LLAMA3_8B): Player => ({ // Default AI model
  id: uuidv4(),
  name,
  hand: [],
  score: 0,
  hasBusted: false,
  hasBlackjack: false,
  hasStood: false,
  chips: 1000,
  bet: 0,
  isActive: false,
  playerType,
  aiModel, // Use aiModel
  resultMessage: undefined,
});

// Initial dealer state
const initialDealerState = {
  id: 'dealer',
  name: 'Dealer',
  hand: [],
  score: 0,
  hasBusted: false,
  hasBlackjack: false,
  hasStood: false,
  isActive: false,
};

// Initial game state
const initialState: GameState = {
  deck: [],
  players: [createNewPlayer('Player 1')],
  dealer: initialDealerState,
  currentPlayerIndex: 0,
  isGameOver: false,
  message: 'Place your bets to start the game',
  isPlayerTurn: true,
  round: 0,
  gamePhase: GamePhase.BETTING, // Start in betting phase
  aiIsThinking: { playerId: null, action: null }, // Initialize aiIsThinking
};

// Game reducer function
function gameReducer(state: GameState, action: GameAction): GameState {
  // Helper function moved inside the reducer
  function getSuitSymbol(suit: Suit): string {
    switch (suit) {
      case Suit.Hearts: return '♥';
      case Suit.Diamonds: return '♦';
      case Suit.Clubs: return '♣';
      case Suit.Spades: return '♠';
      default: return '';
    }
  }

  switch (action.type) {
    case GameActionType.SET_AI_THINKING:
      return {
        ...state,
        aiIsThinking: { playerId: action.payload.playerId, action: action.payload.action },
        message: `${state.players.find(p => p.id === action.payload.playerId)?.name} is thinking...` // Optional: Update message
      };
    case GameActionType.CLEAR_AI_THINKING:
      return {
        ...state,
        aiIsThinking: { playerId: null, action: null }
        // Optionally, reset main message if AI thinking message was showing
        // message: state.aiIsThinking.playerId ? "Player's turn" : state.message // Example
      };
    case GameActionType.UPDATE_MESSAGE:
      return {
        ...state,
        message: action.payload.message
      };
    case GameActionType.START_BETTING_PHASE: {
      // Reset player hands, scores, status, and result messages for a new round
      const updatedPlayers = state.players.map(player => ({
        ...player,
        bet: 0,
        hand: [],
        score: 0,
        hasBusted: false,
        hasBlackjack: false,
        hasStood: false,
        isActive: false,
        resultMessage: undefined, // Clear previous result message
      }));
        // Reset dealer hand and score
      const updatedDealer = {
        ...initialDealerState,
        hand: [],
        score: 0,
        isActive: false,
      };

      return {
        ...state,
        players: updatedPlayers,
        dealer: updatedDealer,
        gamePhase: GamePhase.BETTING,
        message: 'Place your bets to start the game',
        isGameOver: false, // Ensure game is not over
        currentPlayerIndex: 0, // Reset current player index
      };
    }

    case GameActionType.DEAL: {
      // Check if all players have placed bets
      const allPlayersHaveBets = state.players.every(player => player.bet > 0);
      if (!allPlayersHaveBets) {
        return {
          ...state,
          message: 'All players must place a bet before dealing'
        };
      }

      const deck = createDeck();
      let newDeck = [...deck];
      
      // Deal cards to each player individually
      let newPlayers = state.players.map(player => {
        const { playerHand, newDeck: deckAfterPlayerDeal } = initialDealForPlayer(newDeck);
        newDeck = deckAfterPlayerDeal; // Update deck after dealing to this player
        
        const playerScore = calculateScore(playerHand);
        const playerHasBlackjack = isBlackjack(playerHand);
        
        return {
          ...player,
          hand: playerHand,
          score: playerScore,
          hasBusted: false, // Reset bust status
          hasBlackjack: playerHasBlackjack,
          hasStood: playerHasBlackjack, // Auto-stand on blackjack
          isActive: false, // Will be set below
          resultMessage: undefined, // Clear previous result
        };
      });
      
      // Deal cards to dealer
      const { dealerHand, newDeck: finalDeck } = dealToDealer(newDeck);
      // Calculate dealer score based ONLY on the face-up card initially
      const dealerScore = calculateScore(dealerHand.filter(card => card.faceUp)); 
      const dealerHasBlackjack = isBlackjack(dealerHand); // Check if dealer has BJ (even with hidden card)

      // Determine the first active player (who doesn't have Blackjack)
      const firstActivePlayerIndex = newPlayers.findIndex(player => !player.hasBlackjack);
      
      // If all players have blackjack, or dealer has blackjack, game might end quickly
      const allPlayersHaveBlackjack = newPlayers.every(p => p.hasBlackjack);
      
      let gamePhase = GamePhase.PLAYER_TURNS;
      let message = '';
      let currentPlayerIndex = firstActivePlayerIndex >= 0 ? firstActivePlayerIndex : 0; // Default to 0 if all have BJ

      // Set active flag only for the current player if there are active players
      if (firstActivePlayerIndex !== -1) {
         newPlayers = newPlayers.map((player, index) => ({
           ...player,
           isActive: index === firstActivePlayerIndex
         }));
         message = `${newPlayers[currentPlayerIndex].name}'s turn`;
      } else {
         // All players have blackjack, or no players left to play
         gamePhase = GamePhase.DEALER_TURN; // Skip player turns
         message = allPlayersHaveBlackjack ? "All players have Blackjack! Checking dealer..." : "Dealer's turn.";
      }
      
      // Handle immediate dealer blackjack scenario
      if (dealerHasBlackjack) {
        gamePhase = GamePhase.DEALER_TURN; // Go straight to dealer turn/resolution
        message = "Dealer has Blackjack!";
      }

      return {
        ...state,
        deck: finalDeck,
        players: newPlayers,        dealer: {
          ...initialDealerState,
          hand: dealerHand,
          score: dealerScore, // Initial score based on face-up card
          hasBlackjack: dealerHasBlackjack,
          isActive: false,
        },
        currentPlayerIndex,
        isGameOver: false,
        message: message,
        isPlayerTurn: gamePhase === GamePhase.PLAYER_TURNS, // Only true if players need to play
        gamePhase: gamePhase,
        round: state.round + 1,
      };
    }
    
    case GameActionType.HIT: {
      if (state.gamePhase !== GamePhase.PLAYER_TURNS || !state.isPlayerTurn) {
        console.log(`[GameReducer] HIT: Action ignored, not player's turn or wrong phase. Phase: ${state.gamePhase}, IsPlayerTurn: ${state.isPlayerTurn}`);
        return state;
      }
      
      const currentPlayer = state.players[state.currentPlayerIndex];
      console.log(`[GameReducer] HIT: Player ${currentPlayer.name} (Type: ${currentPlayer.playerType}) hits. Current Score: ${currentPlayer.score}`);
      
      const [newCard, newDeck] = drawCard(state.deck);
      const newHand = [...currentPlayer.hand, newCard];
      const newScore = calculateScore(newHand);
      const playerBusted = hasBusted(newHand);
      
      console.log(`[GameReducer] HIT: Player ${currentPlayer.name} drew ${newCard.value}${getSuitSymbol(newCard.suit)}. New Score: ${newScore}, Busted: ${playerBusted}`);
      
      // Update current player's hand and status
      let updatedPlayers = state.players.map((player, index) => {
        if (index === state.currentPlayerIndex) {
          return {
            ...player,
            hand: newHand,
            score: newScore,
            hasBusted: playerBusted,
            hasStood: playerBusted, // If busted, player also effectively "stands"
          };
        }
        return player;
      });
      
      if (playerBusted) {
        console.log(`[GameReducer] HIT: Player ${currentPlayer.name} busted!`);
        // Player is now inactive, move to next player or dealer's turn
        const nextPlayerIndex = findNextActivePlayerIndex(updatedPlayers, state.currentPlayerIndex);
        
        const playersWithActiveStatus = updatedPlayers.map((player, index) => ({
          ...player,
          // Current player (busted) becomes inactive. Next player (if any) becomes active.
          isActive: index === nextPlayerIndex && !player.hasStood && !player.hasBusted 
        }));
        updatedPlayers = playersWithActiveStatus; // Assign back
        
        if (nextPlayerIndex === -1) {
          console.log(`[GameReducer] HIT: All players done. Transitioning to Dealer's Turn.`);
          return {
            ...state,
            deck: newDeck,
            players: updatedPlayers,
            message: `${currentPlayer.name} busted! Dealer's turn.`,
            gamePhase: GamePhase.DEALER_TURN,
            isPlayerTurn: false,
          };
        } else {
          console.log(`[GameReducer] HIT: Next player is ${updatedPlayers[nextPlayerIndex].name}.`);
          return {
            ...state,
            deck: newDeck,
            players: updatedPlayers,
            currentPlayerIndex: nextPlayerIndex,
            message: `${currentPlayer.name} busted! ${updatedPlayers[nextPlayerIndex].name}'s turn`,
          };
        }
      }
      
      // Player hit and did not bust, their turn continues (isActive remains true)
      console.log(`[GameReducer] HIT: Player ${currentPlayer.name} continues turn.`);
      return {
        ...state,
        deck: newDeck,
        players: updatedPlayers,
        message: `${currentPlayer.name} hits and gets ${newCard.value}${getSuitSymbol(newCard.suit)}`,
      };
    }
    
    case GameActionType.STAND: {
      if (state.gamePhase !== GamePhase.PLAYER_TURNS || !state.isPlayerTurn) {
        console.log(`[GameReducer] STAND: Action ignored, not player's turn or wrong phase. Phase: ${state.gamePhase}, IsPlayerTurn: ${state.isPlayerTurn}`);
        return state;
      }
      
      const currentPlayer = state.players[state.currentPlayerIndex];
      console.log(`[GameReducer] STAND: Player ${currentPlayer.name} (Type: ${currentPlayer.playerType}) stands. Score: ${currentPlayer.score}`);
      
      // Update current player to stood status and make them inactive
      let updatedPlayers = state.players.map((player, index) => {
        if (index === state.currentPlayerIndex) {
          return {
            ...player,
            hasStood: true,
            isActive: false, // Player's turn ends on stand
          };
        }
        return player;
      });
      
      const nextPlayerIndex = findNextActivePlayerIndex(updatedPlayers, state.currentPlayerIndex);
      
      if (nextPlayerIndex === -1) {
        console.log(`[GameReducer] STAND: All players done. Transitioning to Dealer's Turn.`);
        // All players are done, dealer's turn
        return {
          ...state,
          players: updatedPlayers, // Contains the player who just stood (now inactive)
          message: `${currentPlayer.name} stands. Dealer's turn.`,
          gamePhase: GamePhase.DEALER_TURN,
          isPlayerTurn: false,
        };
      } else {
        // Set next player as active
        const playersWithNextActive = updatedPlayers.map((player, index) => ({
          ...player,
          isActive: index === nextPlayerIndex // Only the next player becomes active
        }));
        updatedPlayers = playersWithNextActive; // Assign back

        console.log(`[GameReducer] STAND: Next player is ${updatedPlayers[nextPlayerIndex].name}.`);
        return {
          ...state,
          players: updatedPlayers,
          currentPlayerIndex: nextPlayerIndex,
          message: `${currentPlayer.name} stands. ${updatedPlayers[nextPlayerIndex].name}'s turn`,
        };
      }
    }
    
    // Remove NEXT_PLAYER as HIT/STAND handles transitions
    /*
    case GameActionType.NEXT_PLAYER: {
      // ... removed ...
    }
    */
    
    case GameActionType.ADD_PLAYER: {
      if (state.players.length >= 4) {
        return {
          ...state,
          message: 'Maximum 4 players allowed'
        };
      }
      
      const newPlayer = createNewPlayer(action.payload.name);
      
      return {
        ...state,
        players: [...state.players, newPlayer],
        message: `${action.payload.name} joined the game`
      };
    }
    
    case GameActionType.REMOVE_PLAYER: {
      if (state.players.length <= 1) {
        return state;
      }
      
      const updatedPlayers = state.players.filter(p => p.id !== action.payload.id);
      
      // Adjust current player index if needed
      let newCurrentPlayerIndex = state.currentPlayerIndex;
      if (updatedPlayers.length <= state.currentPlayerIndex) {
        newCurrentPlayerIndex = updatedPlayers.length - 1;
      }
      
      return {
        ...state,
        players: updatedPlayers,
        currentPlayerIndex: newCurrentPlayerIndex,
        message: 'Player removed from the game'
      };
    }
    
    case GameActionType.PLACE_BET: {
      if (state.gamePhase !== GamePhase.BETTING) {
        return state;
      }
      
      const { playerId, amount } = action.payload;
      
      // Validate bet
      const player = state.players.find(p => p.id === playerId);
      if (!player || amount > player.chips) {
        return {
          ...state,
          message: 'Invalid bet: Not enough chips'
        };
      }
      
      const updatedPlayers = state.players.map(player => {
        if (player.id === playerId) {
          return {
            ...player,
            bet: amount,
            chips: player.chips - amount
          };
        }
        return player;
      });
      
      // Check if all players have bet
      const allPlayersHaveBets = updatedPlayers.every(player => player.bet > 0);
      
      return {
        ...state,
        players: updatedPlayers,
        message: allPlayersHaveBets 
          ? 'All bets placed! Click "Deal Cards" to begin.' 
          : `${player?.name} placed a bet of $${amount}. Waiting for other players...`
      };
    }
    
    case GameActionType.RESET: {
      return {
        ...initialState,
        players: state.players.map(player => ({
          ...createNewPlayer(player.name),
          id: player.id,
          chips: 1000 // Reset chips to 1000
        }))
      };
    }
      case GameActionType.ADD_AI_PLAYER: {
      if (state.players.length >= 4) {
        return {
          ...state,
          message: 'Maximum 4 players allowed'
        };
      }

      const aiName = `AI Player ${state.players.filter(p => p.playerType === PlayerType.AI).length + 1}`; // Better naming
      const newAIPlayer = createNewPlayer(
        aiName,
        PlayerType.AI,
        action.payload.model // Use model from payload
      );

      return {
        ...state,
        players: [...state.players, newAIPlayer],
        message: `${aiName} (AI - ${action.payload.model}) joined the game`
      };
    }

    case GameActionType.TOGGLE_PLAYER_TYPE: {
      const { playerId, playerType, model } = action.payload;

      const updatedPlayers = state.players.map(player => {
        if (player.id === playerId) {
          const defaultModel = playerType === PlayerType.AI ? AIModel.LLAMA3_8B : undefined; // Default model if switching to AI
          const newModel = playerType === PlayerType.AI ? (model || player.aiModel || defaultModel) : undefined;
          const baseName = player.name.replace(/^AI\s*/, ''); // Remove potential existing "AI " prefix
          const newName = playerType === PlayerType.AI ? `AI ${baseName}` : baseName;

          return {
            ...player,
            playerType,
            aiModel: newModel, // Use selected or default model
            name: newName
          };
        }
        return player;
      });

      return {
        ...state,
        players: updatedPlayers,
        message: `Player type changed for ${updatedPlayers.find(p => p.id === playerId)?.name}`
      };
    }
    
    // New action to process the results after dealer plays
    case GameActionType.PROCESS_DEALER_TURN: {
      // Use the result from the dealer turn
      const { players, dealer, deck } = action.payload;
      
      return {
        ...state,
        players,
        dealer,
        deck,
        isGameOver: true,
        gamePhase: GamePhase.GAME_OVER,
        message: "Game over! Start a new round to play again.",
        isPlayerTurn: false,
      };
    }
    
    default:
      // Add a check for the non-standard action type from useEffect
      if ((action as any).type === 'REPLACE_STATE') {
        return (action as any).payload;
      }
      return state;
  }
}

// Deal two cards to player
function initialDealForPlayer(deck: Card[]): { playerHand: Card[], newDeck: Card[] } {
  let newDeck = [...deck];
  let playerHand: Card[] = [];
  
  // Deal first card face up
  let card: Card;
  [card, newDeck] = drawCard(newDeck, true);
  playerHand.push(card);
  
  // Deal second card face up
  [card, newDeck] = drawCard(newDeck, true);
  playerHand.push(card);
  
  return { playerHand, newDeck };
}

// Deal two cards to dealer - second one face down
function dealToDealer(deck: Card[]): { dealerHand: Card[], newDeck: Card[] } {
  let newDeck = [...deck];
  let dealerHand: Card[] = [];
  
  // Deal first card face up
  let card: Card;
  [card, newDeck] = drawCard(newDeck, true);
  dealerHand.push(card);
  
  // Deal second card face down
  [card, newDeck] = drawCard(newDeck, false);
  dealerHand.push(card);
  
  return { dealerHand, newDeck };
}

// Find the next active player who hasn't stood or busted
function findNextActivePlayerIndex(players: Player[], currentIndex: number): number {
  for (let i = currentIndex + 1; i < players.length; i++) {
    if (!players[i].hasStood && !players[i].hasBusted) {
      return i;
    }
  }
  return -1; // No more active players
}

// Helper function to handle dealer turn
function handleDealerTurn(state: GameState, players: Player[], deck: Card[]) {
  // Create dealer object
  const dealer = {
    ...state.dealer,
    hand: state.dealer.hand.map(card => ({
      ...card,
      faceUp: true // Reveal all dealer cards
    }))
  };
  
  // Let dealer play using the dealerPlay function
  const dealerResult = dealerPlay(dealer, [...deck]);
    // Determine winners and update players
  const finalPlayers = players.map(player => {
    if (player.hasBusted) {
      // Player already busted
      return {
        ...player,
        resultMessage: 'Busted! -$' + player.bet,
        chips: player.chips - player.bet,
      };
    }
    
    if (player.hasBlackjack && !dealerResult.dealer.hasBlackjack) {
      // Player has blackjack and dealer doesn't - 3:2 payout
      const winAmount = Math.floor(player.bet * 1.5);
      return {
        ...player,
        resultMessage: 'Blackjack! +$' + winAmount,
        chips: player.chips + winAmount,
      };
    }
    
    if (player.hasBlackjack && dealerResult.dealer.hasBlackjack) {
      // Both have blackjack - push
      return {
        ...player,
        resultMessage: 'Push!',
        chips: player.chips, // Return bet
      };
    }
    
    if (dealerResult.dealer.hasBusted) {
      // Dealer busted, player wins
      return {
        ...player,
        resultMessage: 'Dealer busted! +$' + player.bet,
        chips: player.chips + player.bet,
      };
    }
    
    if (player.score > dealerResult.dealer.score) {
      // Player score beats dealer
      return {
        ...player,
        resultMessage: 'You win! +$' + player.bet,
        chips: player.chips + player.bet,
      };
    }
    
    if (player.score === dealerResult.dealer.score) {
      // Push - tie score
      return {
        ...player,
        resultMessage: 'Push!',
        chips: player.chips, // Return bet
      };
    }
    
    // Dealer wins
    return {
      ...player,
      resultMessage: 'Dealer wins! -$' + player.bet,
      chips: player.chips - player.bet,
    };
  });
  
  return {
    players: finalPlayers,
    dealer: dealerResult.dealer,
    deck: dealerResult.deck
  };
}

// Custom hook for blackjack game
export function useGameReducer() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Watch for dealer turn phase to automatically play dealer's hand
  useEffect(() => {
    if (state.gamePhase === GamePhase.DEALER_TURN && !state.isGameOver) {
      const timerId = setTimeout(() => {
        const result = handleDealerTurn(state, state.players, state.deck);
        dispatch({ type: GameActionType.PROCESS_DEALER_TURN, payload: result });
      }, 1500);
      return () => clearTimeout(timerId);
    }
  }, [state.gamePhase, state.isGameOver, state.players, state.deck]);

  // AI Betting - Process AI bets when in betting phase
  useEffect(() => {
    if (state.gamePhase === GamePhase.BETTING) {
      const processAIBetsSerially = async () => {
        for (const player of state.players) {
          if (player.playerType === PlayerType.AI && player.bet === 0 && player.chips > 0) {
            console.log(`AI ${player.name} (Model: ${player.aiModel}) is fetching a bet...`);
            dispatch({ type: GameActionType.SET_AI_THINKING, payload: { playerId: player.id, action: 'betting' } });
            await new Promise(resolve => setTimeout(resolve, 800)); // Delay for UX

            let betAmount;
            let usedFallback = false;
            try {
              betAmount = await getAIBetDecision(player.chips, player.aiModel);
              console.log(`AI ${player.name} (Model: ${player.aiModel}) successfully received bet: ${betAmount}`);
            } catch (error: any) {
              usedFallback = true;
              if (error.name === 'TimeoutError') {
                console.warn(`AI ${player.name} (Model: ${player.aiModel}) bet request timed out. Applying fallback.`);
              } else {
                console.error(`Error processing AI bet for ${player.name} (Model: ${player.aiModel}): ${error.message}. Applying fallback.`);
              }
              betAmount = Math.max(10, Math.min(Math.floor(player.chips * 0.05), 100));
              betAmount = Math.min(betAmount, player.chips);
              console.log(`AI ${player.name} (Model: ${player.aiModel}) using fallback bet: ${betAmount}`);
            } finally {
              dispatch({ type: GameActionType.CLEAR_AI_THINKING });
            }

            if (betAmount > 0) {
              dispatch({
                type: GameActionType.PLACE_BET,
                payload: { playerId: player.id, amount: betAmount }
              });
              if (usedFallback) {
                // Dispatch a new action or update message directly if reducer handles it
                // For simplicity, we'll update message in reducer after PLACE_BET if a flag is passed
                // Or, more directly, if the reducer handles a specific "AI_FALLBACK_BET" action.
                // For now, let's assume PLACE_BET can optionally take a message update.
                // This part needs careful implementation depending on how message updates are structured.
                // A simpler approach: the component checks aiIsThinking and if player is AI, then shows thinking.
                // The message update for fallback can be done in the reducer handling PLACE_BET,
                // if we augment PLACE_BET or add a new action.
                // Let's make a new action for setting messages for clarity.
                // gameReducer will need to handle a new GameActionType.SET_MESSAGE
                // This is getting complex. Let's try to update message directly in the reducer for PLACE_BET
                // if a fallback occurred.
                // For now, let's assume the existing console.warn is the primary notification,
                // and we focus on the "thinking" indicator.
                // The subtask asks to update `state.message` for fallbacks.
                // We can dispatch a separate action for message update or make reducer smarter.
                
                // Let's try dispatching a message update.
                // This means GameState needs a 'SET_MESSAGE' action type.
                // And GameAction needs to include it.
                // This was not part of the initial plan for GameActionType.
                // Let's just update message in the existing dispatch for now.
                // This requires PLACE_BET to handle an optional message.
                // This is not ideal.

                // Correct approach: dispatch a specific action to update message after fallback.
                // Let's assume we add a new action type SET_GAME_MESSAGE
                // For now, I will just set the message in the console and proceed with AI thinking.
                // The prompt says: "update the state.message to subtly reflect this"
                // This implies the reducer should do it.
                // So, when dispatching PLACE_BET for a fallback, we need to signify it.
                // Let's add a flag to PLACE_BET payload.
                 const fallbackMessage = `${player.name} used a fallback bet.`;
                 // We need to ensure the reducer can set this message.
                 // Modifying PLACE_BET in gameReducer to optionally accept a message.
                 // This is not ideal as PLACE_BET is generic.

                // Alternative: a new action type like UPDATE_MESSAGE
                // Let's assume we add: { type: GameActionType.UPDATE_MESSAGE, payload: string } to types and reducer.
                // For now, I'll just log it here as per previous structure.
                // The task is to update state.message. This MUST happen in the reducer.
                // Simplest path: add new action type for specifically setting message.
                // Adding to types.ts: UPDATE_MESSAGE
                // Adding to reducer: handle UPDATE_MESSAGE
                // The task is to update state.message. This MUST happen in the reducer.
                // Simplest path: add new action type for specifically setting message.
                // Adding to types.ts: UPDATE_MESSAGE
                // Adding to reducer: handle UPDATE_MESSAGE
                // This is the cleanest way.
                dispatch({ type: GameActionType.UPDATE_MESSAGE, payload: { message: `${player.name} used a fallback bet.` } });
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              console.warn(`AI ${player.name} (Model: ${player.aiModel}) has no chips to bet or fallback bet was zero.`);
            }
          }
        }
      };
      processAIBetsSerially();
    }
  }, [state.gamePhase, state.players.map(p => `${p.id}-${p.playerType}-${p.chips}`).join(',')]);


  // AI Decision Making for Hit/Stand
  useEffect(() => {
    if (
      state.gamePhase === GamePhase.PLAYER_TURNS &&
      state.isPlayerTurn &&
      state.players.length > state.currentPlayerIndex
    ) {
      const currentPlayer = state.players[state.currentPlayerIndex];

      if (
        currentPlayer &&
        currentPlayer.playerType === PlayerType.AI &&
        currentPlayer.isActive &&
        !currentPlayer.hasStood &&
        !currentPlayer.hasBusted
      ) {
        const dealerUpCard = state.dealer.hand.find(card => card.faceUp) || null;
        const aiModel = currentPlayer.aiModel || AIModel.LLAMA3_8B;

        console.log(`AI ${currentPlayer.name} (Model: ${aiModel}) is fetching a decision...`);
        dispatch({ type: GameActionType.SET_AI_THINKING, payload: { playerId: currentPlayer.id, action: 'playing' } });

        const timerId = setTimeout(async () => {
          let decision: 'HIT' | 'STAND';
          let usedFallback = false;
          try {
            decision = await getAIDecision(
              currentPlayer.hand,
              currentPlayer.score,
              dealerUpCard,
              state.players.filter(p => p.id !== currentPlayer.id),
              aiModel
            );
            console.log(`AI ${currentPlayer.name} (Model: ${aiModel}) successfully received decision: ${decision}`);
          } catch (error: any) {
            usedFallback = true;
            if (error.name === 'TimeoutError') {
              console.warn(`AI ${currentPlayer.name} (Model: ${aiModel}) decision request timed out. Applying fallback strategy.`);
            } else {
              console.error(`Error getting AI decision for ${currentPlayer.name} (Model: ${aiModel}): ${error.message}. Applying fallback strategy.`);
            }
            decision = currentPlayer.score < 17 ? 'HIT' : 'STAND';
            console.log(`AI ${currentPlayer.name} (Model: ${aiModel}) using fallback decision: ${decision}`);
          } finally {
            dispatch({ type: GameActionType.CLEAR_AI_THINKING });
          }
          
          dispatch({ type: decision }); // Dispatch HIT or STAND

          if (usedFallback) {
            // Similar to betting, we need a way to update the message.
            // Let's assume GameActionType.UPDATE_MESSAGE and its handling in reducer are added.
            // dispatch({ type: GameActionType.UPDATE_MESSAGE, payload: `${currentPlayer.name} used a fallback move (${decision}).` });
            // For now, relying on console logs for this specific detail and focusing on the "thinking" indicator.
            // The reducer for HIT/STAND would need to be aware of the fallback to set the message.
            // This is tricky without a new action or modifying HIT/STAND payloads.
            // The task implies state.message should be updated.
            // Let's assume for now that the HIT/STAND reducers will be enhanced to set this message
            // if a certain flag is passed, or a new action is introduced.
            // For now, the console log will have to do for the detailed fallback message.
            // The main message will be cleared by CLEAR_AI_THINKING or overwritten by HIT/STAND.
            dispatch({ type: GameActionType.UPDATE_MESSAGE, payload: { message: `${currentPlayer.name} used a fallback move (${decision}).` } });
          }
        }, 1200);

        return () => {
          clearTimeout(timerId);
          // Ensure 'thinking' is cleared if component unmounts or effect re-runs prematurely
          if (state.aiIsThinking.playerId === currentPlayer?.id) { // Added null check for currentPlayer
            dispatch({ type: GameActionType.CLEAR_AI_THINKING });
          }
        };
      }
    }
    // Dependency array: Reacts to changes in current player's turn, active status, or game phase.
    // Using a map of relevant player states ensures this effect runs when any AI player's specific state changes.
    // This is more targeted than watching all players for all changes.
    // Key properties: currentPlayerIndex, and for that player: isActive, hasStood, hasBusted.
    // Also depends on gamePhase and isPlayerTurn.
  }, [
    state.gamePhase, 
    state.isPlayerTurn, 
    state.currentPlayerIndex, 
    state.players[state.currentPlayerIndex]?.isActive, // Ensures effect runs if current player's active status changes
    state.players[state.currentPlayerIndex]?.hasStood,  // Ensures effect runs if current player stands
    state.players[state.currentPlayerIndex]?.hasBusted, // Ensures effect runs if current player busts
    state.players[state.currentPlayerIndex]?.playerType,// Ensures effect runs if player type changes (e.g. human to AI)
    state.players[state.currentPlayerIndex]?.aiModel,   // Ensures effect runs if AI model changes
    // state.dealer.hand.find(card => card.faceUp)?.id, // More stable check for dealer up card, if ID is available and stable
    // The stringify was a bit heavy, let's rely on other state changes primarily.
    // If dealer card changes mid-turn (not standard blackjack), then a more robust check is needed.
    // For now, current dependencies should be sufficient for typical blackjack flow.
    // Re-add stringified dealer card if issues arise with dealer card changes not triggering effect.
    JSON.stringify(state.dealer.hand.find(card => card.faceUp))
  ]);

  return { state, dispatch };
}
