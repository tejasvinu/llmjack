import { useReducer, useEffect, useState, useRef } from 'react';
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
        return state;
      }
      
      const currentPlayer = state.players[state.currentPlayerIndex];
      const [newCard, newDeck] = drawCard(state.deck);
      const newHand = [...currentPlayer.hand, newCard];
      const newScore = calculateScore(newHand);
      const playerBusted = hasBusted(newHand);
      
      // Update current player's hand
      const updatedPlayers = state.players.map((player, index) => {
        if (index === state.currentPlayerIndex) {
          return {
            ...player,
            hand: newHand,
            score: newScore, // Make sure newScore is assigned
            hasBusted: playerBusted,
            hasStood: playerBusted, 
          };
        }
        return player;
      });
      
      if (playerBusted) {
        // Move to next player or end game
        const nextPlayerIndex = findNextActivePlayerIndex(updatedPlayers, state.currentPlayerIndex);
        
        // Update active status for all players
        const playersWithActiveStatus = updatedPlayers.map((player, index) => ({
          ...player,
          isActive: index === nextPlayerIndex && !player.hasStood && !player.hasBusted
        }));
        
        if (nextPlayerIndex === -1) {
          // All players are done, dealer's turn
          return {
            ...state,
            deck: newDeck,
            players: playersWithActiveStatus,
            message: `${currentPlayer.name} busted! Dealer's turn.`,
            gamePhase: GamePhase.DEALER_TURN,
            isPlayerTurn: false,
          };
        } else {
          return {
            ...state,
            deck: newDeck,
            players: playersWithActiveStatus,
            currentPlayerIndex: nextPlayerIndex,
            message: `${currentPlayer.name} busted! ${playersWithActiveStatus[nextPlayerIndex].name}'s turn`,
          };
        }
      }
      
      return {
        ...state,
        deck: newDeck,
        players: updatedPlayers,
        // Use the inner getSuitSymbol function
        message: `${currentPlayer.name} hits and gets ${newCard.value}${getSuitSymbol(newCard.suit)}`,
      };
    }
    
    case GameActionType.STAND: {
      if (state.gamePhase !== GamePhase.PLAYER_TURNS || !state.isPlayerTurn) {
        return state;
      }
      
      const currentPlayer = state.players[state.currentPlayerIndex];
      
      // Update current player to stood status
      const updatedPlayers = state.players.map((player, index) => {
        if (index === state.currentPlayerIndex) {
          return {
            ...player,
            hasStood: true,
            isActive: false,
          };
        }
        return player;
      });
      
      // Find next active player
      const nextPlayerIndex = findNextActivePlayerIndex(updatedPlayers, state.currentPlayerIndex);
      
      if (nextPlayerIndex === -1) {
        // All players are done, dealer's turn
        return {
          ...state,
          players: updatedPlayers,
          message: `${currentPlayer.name} stands. Dealer's turn.`,
          gamePhase: GamePhase.DEALER_TURN,
          isPlayerTurn: false,
        };
      } else {
        // Set next player as active
        const playersWithNextActive = updatedPlayers.map((player, index) => ({
          ...player,
          isActive: index === nextPlayerIndex
        }));
        
        return {
          ...state,
          players: playersWithNextActive,
          currentPlayerIndex: nextPlayerIndex,
          message: `${currentPlayer.name} stands. ${playersWithNextActive[nextPlayerIndex].name}'s turn`,
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
  const [aiActionInProgress, setAiActionInProgress] = useState(false);
  // Add a ref to track player betting state
  const playerBettingStateRef = useRef('');
  
  // Watch for dealer turn phase to automatically play dealer's hand
  useEffect(() => {
    if (state.gamePhase === GamePhase.DEALER_TURN && !state.isGameOver) {
      // Wait a moment to show dealer's face-down card flip visually
      const timerId = setTimeout(() => {
        // Calculate the results
        const result = handleDealerTurn(state, state.players, state.deck);
        // Dispatch the new action with the results
        dispatch({ type: GameActionType.PROCESS_DEALER_TURN, payload: result });
      }, 1500); // Increased delay slightly for better visual flow
      
      return () => clearTimeout(timerId);
    }
  // Add state.isGameOver to dependencies to prevent re-triggering after game ends
  }, [state.gamePhase, state.isGameOver, state.players, state.deck]); 
  
  // AI Betting - Process AI bets when in betting phase
  useEffect(() => {
    // Update the ref with current player betting state
    const newPlayerBettingState = state.players
      .map(p => `${p.id}-${p.bet}-${p.playerType}`)
      .join(',');
      
    // Only continue if the betting state has changed or game phase changed
    if (state.gamePhase === GamePhase.BETTING && 
        (playerBettingStateRef.current !== newPlayerBettingState || 
         playerBettingStateRef.current === '')) {
      // Store the new betting state
      playerBettingStateRef.current = newPlayerBettingState;
      
      const processAIBets = async () => {
        // Filter out AI players who haven't bet yet and have chips
        const aiPlayersNeedingBets = state.players.filter(
          player => player.playerType === PlayerType.AI && player.bet === 0 && player.chips > 0
        );

        if (aiPlayersNeedingBets.length > 0) {
          // Process one AI bet at a time with delay
          const currentAI = aiPlayersNeedingBets[0];

          // Add a delay before fetching the bet
          await new Promise(resolve => setTimeout(resolve, 800)); // Delay before API call

          try {
            // Get AI bet decision using the player's assigned model
            const betAmount = await getAIBetDecision(currentAI.chips, currentAI.aiModel);

            // Apply the bet immediately after getting the result
            dispatch({
              type: GameActionType.PLACE_BET,
              payload: {
                playerId: currentAI.id,
                amount: betAmount
              }
            });
          } catch (error) {
            console.error(`Error processing AI bet for ${currentAI.name}:`, error);
            // Fallback to a default bet amount if API fails
            const defaultBet = Math.min(50, currentAI.chips); // Ensure default bet is possible
             if (defaultBet > 0) {
               dispatch({
                 type: GameActionType.PLACE_BET,
                 payload: {
                   playerId: currentAI.id,
                   amount: defaultBet
                 }
               });
             }
          }
        }
      };

      processAIBets();
    }
  // Simpler dependency array that won't cause infinite loops
  }, [state.gamePhase, state.players]);

  // AI Decision Making for Hit/Stand
  useEffect(() => {
    if (
      state.gamePhase === GamePhase.PLAYER_TURNS &&
      state.isPlayerTurn &&
      state.players.length > state.currentPlayerIndex &&
      !aiActionInProgress // Check lock
    ) {
      const currentPlayer = state.players[state.currentPlayerIndex];

      if (
        currentPlayer &&
        currentPlayer.playerType === PlayerType.AI &&
        currentPlayer.isActive &&
        !currentPlayer.hasStood &&
        !currentPlayer.hasBusted
      ) {
        setAiActionInProgress(true); // Set lock
        const dealerUpCard = state.dealer.hand.find(card => card.faceUp) || null;
        const timerId = setTimeout(async () => {
          try {
            const decision = await getAIDecision(
              currentPlayer.hand,
              currentPlayer.score,
              dealerUpCard,
              state.players.filter(p => p.id !== currentPlayer.id),
              currentPlayer.aiModel || AIModel.LLAMA3_8B
            );
            dispatch({ type: decision === 'HIT' ? GameActionType.HIT : GameActionType.STAND });
          } catch (error) {
            console.error(`Error getting AI decision for ${currentPlayer.name} (${currentPlayer.aiModel}):`, error);
            dispatch({ type: currentPlayer.score < 17 ? GameActionType.HIT : GameActionType.STAND });
          } finally {
            setAiActionInProgress(false); // Release lock
          }
        }, 1200);

        return () => {
          clearTimeout(timerId);
          setAiActionInProgress(false); // Ensure lock is released on cleanup
        };
      }
    }
  },
  [state.gamePhase, state.isPlayerTurn, state.players, state.currentPlayerIndex, state.dealer.hand] // Removed aiActionInProgress
);

  return { state, dispatch };
}
