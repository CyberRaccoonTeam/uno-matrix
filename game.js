/**
 * UNO Game Logic - Matrix Theme
 * Pure vanilla JavaScript implementation
 * 
 * Game Rules:
 * - 108 cards: 4 colors (red, blue, green, yellow), numbers 0-9, actions, wilds
 * - Deal 7 cards each, match color OR number/action to play
 * - Wilds playable anytime, player picks color
 * - First to empty hand wins the round
 * - First to 500 points wins the game
 */

// ============================================
// GAME STATE
// ============================================

const GameState = {
  deck: [],
  discardPile: [],
  playerHand: [],
  aiHand: [],
  currentPlayer: 'player', // 'player' or 'ai'
  gameDirection: 1, // 1 = clockwise, -1 = counter-clockwise
  gameStatus: 'waiting', // 'waiting', 'playing', 'gameover'
  winner: null,
  playerScore: 0,
  aiScore: 0,
  unoCalled: false,
  drawStack: 0, // For stacking draw cards
  currentColor: null // For wild cards
};

// ============================================
// CARD CREATION & DECK MANAGEMENT
// ============================================

/**
 * Create a full UNO deck (108 cards)
 * @returns {Array} Array of card objects
 */
function createDeck() {
  const deck = [];
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  // Number cards (0-9)
  // One 0 per color, two of 1-9 per color
  colors.forEach(color => {
    // One 0
    deck.push({ color, value: 0, type: 'number', points: 0 });
    
    // Two of each 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: i, type: 'number', points: i });
      deck.push({ color, value: i, type: 'number', points: i });
    }
  });
  
  // Action cards (2 per color): Skip, Reverse, Draw Two
  colors.forEach(color => {
    // Skip (2 per color)
    deck.push({ color, value: 'skip', type: 'action', points: 20, action: 'skip' });
    deck.push({ color, value: 'skip', type: 'action', points: 20, action: 'skip' });
    
    // Reverse (2 per color)
    deck.push({ color, value: 'reverse', type: 'action', points: 20, action: 'reverse' });
    deck.push({ color, value: 'reverse', type: 'action', points: 20, action: 'reverse' });
    
    // Draw Two (2 per color)
    deck.push({ color, value: 'draw2', type: 'action', points: 20, action: 'draw2' });
    deck.push({ color, value: 'draw2', type: 'action', points: 20, action: 'draw2' });
  });
  
  // Wild cards (4 each): Wild, Wild Draw Four
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild', type: 'wild', points: 50, action: 'wild' });
    deck.push({ color: 'black', value: 'wild4', type: 'wild', points: 50, action: 'wild4' });
  }
  
  return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 * @param {Array} deck - Deck to shuffle
 * @returns {Array} Shuffled deck
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal 7 cards to each player
 * @param {Array} deck - The deck to deal from
 * @returns {Object} Object with playerHand and aiHand arrays
 */
function dealCards(deck) {
  const playerHand = [];
  const aiHand = [];
  
  for (let i = 0; i < 7; i++) {
    if (deck.length > 0) playerHand.push(deck.pop());
    if (deck.length > 0) aiHand.push(deck.pop());
  }
  
  return { playerHand, aiHand };
}

// ============================================
// GAME INITIALIZATION
// ============================================

/**
 * Initialize a new game
 * @returns {Object} Game state object
 */
function initGame() {
  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());
  
  // Deal cards
  const { playerHand, aiHand } = dealCards(deck);
  
  // Start discard pile (ensure first card is not a wild)
  let topCard = deck.pop();
  while (topCard.type === 'wild') {
    deck.unshift(topCard);
    topCard = deck.pop();
  }
  
  // Set initial color
  let currentColor = topCard.color;
  
  // Handle first card action
  if (topCard.action === 'reverse') {
    GameState.gameDirection = -1;
  } else if (topCard.action === 'skip') {
    GameState.currentPlayer = 'player'; // AI skips
  } else if (topCard.action === 'draw2') {
    // Player draws 2 and skips
    for (let i = 0; i < 2; i++) {
      if (deck.length > 0) playerHand.push(deck.pop());
    }
    GameState.currentPlayer = 'player';
  }
  
  // Reset game state
  GameState.deck = deck;
  GameState.discardPile = [topCard];
  GameState.playerHand = playerHand;
  GameState.aiHand = aiHand;
  GameState.currentPlayer = 'player';
  GameState.gameDirection = 1;
  GameState.gameStatus = 'playing';
  GameState.winner = null;
  GameState.unoCalled = false;
  GameState.drawStack = 0;
  GameState.currentColor = currentColor;
  
  return GameState;
}

// ============================================
// MOVE VALIDATION
// ============================================

/**
 * Check if a card is a valid move
 * @param {Object} card - Card to check
 * @param {Object} topCard - Top card on discard pile
 * @param {string} currentColor - Current color in play (for wilds)
 * @returns {boolean} True if valid move
 */
function isValidMove(card, topCard, currentColor = null) {
  const effectiveColor = currentColor || topCard.color;
  
  // Wild cards can always be played
  if (card.type === 'wild') return true;
  
  // Match color (including wild-set color)
  if (card.color === effectiveColor) return true;
  
  // Match value/number
  if (card.value === topCard.value) return true;
  
  // Match action type
  if (card.type === 'action' && topCard.type === 'action' && card.action === topCard.action) {
    return true;
  }
  
  return false;
}

/**
 * Get all valid moves from a hand
 * @param {Array} hand - Player's hand
 * @param {Object} topCard - Top card on discard pile
 * @param {string} currentColor - Current color in play
 * @returns {Array} Array of valid card indices
 */
function getValidMoves(hand, topCard, currentColor = null) {
  const validMoves = [];
  hand.forEach((card, index) => {
    if (isValidMove(card, topCard, currentColor)) {
      validMoves.push(index);
    }
  });
  return validMoves;
}

// ============================================
// CARD PLAYING
// ============================================

/**
 * Play a card from the current player's hand
 * @param {number} cardIndex - Index of card in hand
 * @param {string} chosenColor - Color chosen for wild cards (optional)
 * @returns {Object} Result object with success status and game state updates
 */
function playCard(cardIndex, chosenColor = null) {
  const hand = GameState.currentPlayer === 'player' 
    ? GameState.playerHand 
    : GameState.aiHand;
  
  // Validate card index
  if (cardIndex < 0 || cardIndex >= hand.length) {
    return { success: false, error: 'Invalid card index' };
  }
  
  const card = hand[cardIndex];
  const topCard = GameState.discardPile[GameState.discardPile.length - 1];
  
  // Validate move
  if (!isValidMove(card, topCard, GameState.currentColor)) {
    return { success: false, error: 'Invalid move' };
  }
  
  // Remove card from hand
  hand.splice(cardIndex, 1);
  
  // Add to discard pile
  GameState.discardPile.push(card);
  
  // Handle wild card color selection
  if (card.type === 'wild') {
    if (chosenColor) {
      GameState.currentColor = chosenColor;
    } else {
      // Default to card's current color or random
      const colors = ['red', 'blue', 'green', 'yellow'];
      GameState.currentColor = colors[Math.floor(Math.random() * colors.length)];
    }
  } else {
    GameState.currentColor = card.color;
  }
  
  // Check for UNO (1 card remaining)
  const unoCalled = hand.length === 1;
  
  // Handle card actions
  let nextPlayer = GameState.currentPlayer;
  let skipNext = false;
  
  switch (card.action) {
    case 'skip':
      skipNext = true;
      break;
      
    case 'reverse':
      GameState.gameDirection *= -1;
      // In 2-player game, reverse acts like skip
      skipNext = true;
      break;
      
    case 'draw2':
      GameState.drawStack += 2;
      break;
      
    case 'wild4':
      GameState.drawStack += 4;
      break;
  }
  
  // Move to next player
  if (skipNext) {
    // Current player goes again
    nextPlayer = GameState.currentPlayer;
  } else {
    nextPlayer = GameState.currentPlayer === 'player' ? 'ai' : 'player';
  }
  
  // Handle draw stack
  if (GameState.drawStack > 0) {
    const drawingPlayer = nextPlayer;
    const drawingHand = drawingPlayer === 'player' 
      ? GameState.playerHand 
      : GameState.aiHand;
    
    for (let i = 0; i < GameState.drawStack; i++) {
      if (GameState.deck.length > 0) {
        drawingHand.push(GameState.deck.pop());
      } else {
        // Reshuffle discard pile if deck is empty
        reshuffleDeck();
        if (GameState.deck.length > 0) {
          drawingHand.push(GameState.deck.pop());
        }
      }
    }
    
    // Player who drew skips their turn
    GameState.drawStack = 0;
    nextPlayer = GameState.currentPlayer; // Current player goes again
  }
  
  GameState.currentPlayer = nextPlayer;
  
  // Check for win
  const winResult = checkWin();
  
  return {
    success: true,
    card,
    unoCalled,
    win: winResult.won,
    winner: winResult.winner
  };
}

/**
 * Reshuffle discard pile into deck (keeping top card)
 */
function reshuffleDeck() {
  if (GameState.discardPile.length <= 1) return;
  
  const topCard = GameState.discardPile.pop();
  GameState.deck = shuffleDeck(GameState.discardPile);
  GameState.discardPile = [topCard];
}

// ============================================
// DRAW CARD
// ============================================

/**
 * Draw a card from the deck
 * @returns {Object} Drawn card or null if deck empty
 */
function drawCard() {
  // Reshuffle if deck is empty
  if (GameState.deck.length === 0) {
    reshuffleDeck();
  }
  
  if (GameState.deck.length === 0) {
    return null;
  }
  
  const card = GameState.deck.pop();
  
  if (GameState.currentPlayer === 'player') {
    GameState.playerHand.push(card);
  } else {
    GameState.aiHand.push(card);
  }
  
  // Pass turn after drawing
  GameState.currentPlayer = GameState.currentPlayer === 'player' ? 'ai' : 'player';
  
  return card;
}

// ============================================
// AI OPPONENT
// ============================================

/**
 * AI turn - decides and plays a card
 * @returns {Object} Result of AI's play
 */
function aiTurn() {
  if (GameState.currentPlayer !== 'ai') {
    return { success: false, error: 'Not AI turn' };
  }
  
  const hand = GameState.aiHand;
  const topCard = GameState.discardPile[GameState.discardPile.length - 1];
  const validMoves = getValidMoves(hand, topCard, GameState.currentColor);
  
  if (validMoves.length === 0) {
    // No valid moves, draw a card
    const drawnCard = drawCard();
    
    // Try to play the drawn card
    if (drawnCard && isValidMove(drawnCard, topCard, GameState.currentColor)) {
      // Play the drawn card immediately
      const drawnIndex = hand.length - 1;
      return playCardWithAIChoice(drawnIndex);
    }
    
    return { action: 'draw', card: drawnCard };
  }
  
  // AI Strategy: Choose best card to play
  let bestMove = selectBestAIMove(hand, validMoves);
  
  // Play the selected card
  return playCardWithAIChoice(bestMove);
}

/**
 * Select the best AI move based on strategy
 * @param {Array} hand - AI's hand
 * @param {Array} validMoves - Array of valid move indices
 * @returns {number} Index of best card to play
 */
function selectBestAIMove(hand, validMoves) {
  // Strategy priorities:
  // 1. Play action cards that disrupt opponent (skip, reverse, draw2)
  // 2. Play high-point cards to reduce potential loss
  // 3. Save wild cards for emergencies
  // 4. Match color to maintain control
  
  let bestIndex = validMoves[0];
  let bestScore = -Infinity;
  
  validMoves.forEach(index => {
    const card = hand[index];
    let score = 0;
    
    // Prefer action cards (disrupt opponent)
    if (card.type === 'action') {
      score += 30;
      if (card.action === 'skip') score += 10;
      if (card.action === 'reverse') score += 10;
      if (card.action === 'draw2') score += 15;
    }
    
    // Prefer high-point number cards (get rid of them)
    if (card.type === 'number') {
      score += card.value;
    }
    
    // Wild cards are valuable, save them unless necessary
    if (card.type === 'wild') {
      score -= 20; // Penalty for playing wilds early
      if (card.action === 'wild4') score -= 10; // Even more valuable
    }
    
    // Bonus for matching current color (maintain flow)
    if (card.color === GameState.currentColor) {
      score += 5;
    }
    
    // Bonus for playing a card that leaves us with good options
    const remainingHand = hand.filter((_, i) => i !== index);
    const colorCounts = {};
    remainingHand.forEach(c => {
      colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
    });
    // Prefer keeping color diversity
    score += Object.keys(colorCounts).length * 3;
    
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  
  return bestIndex;
}

/**
 * Play card with AI's color choice for wilds
 * @param {number} cardIndex - Index of card to play
 * @returns {Object} Result of play
 */
function playCardWithAIChoice(cardIndex) {
  const hand = GameState.aiHand;
  const card = hand[cardIndex];
  
  let chosenColor = null;
  
  // AI chooses color for wild cards
  if (card.type === 'wild') {
    // Count colors in hand (excluding the wild being played)
    const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
    hand.forEach((c, i) => {
      if (i !== cardIndex && c.color !== 'black') {
        colorCounts[c.color]++;
      }
    });
    
    // Choose color with most cards
    chosenColor = Object.keys(colorCounts).reduce((a, b) => 
      colorCounts[a] > colorCounts[b] ? a : b
    );
  }
  
  const result = playCard(cardIndex, chosenColor);
  
  // Auto-call UNO
  if (result.success && hand.length === 1) {
    callUNO('ai');
  }
  
  return result;
}

// ============================================
// UNO CALLING
// ============================================

/**
 * Call UNO (when player has 1 card)
 * @param {string} player - 'player' or 'ai'
 * @returns {boolean} True if UNO was called successfully
 */
function callUNO(player) {
  const hand = player === 'player' ? GameState.playerHand : GameState.aiHand;
  
  if (hand.length === 1) {
    GameState.unoCalled = true;
    return true;
  }
  
  // Can only call UNO with exactly 1 card
  return false;
}

// ============================================
// WIN CONDITION
// ============================================

/**
 * Check if current player has won
 * @returns {Object} Win status and winner
 */
function checkWin() {
  let winner = null;
  
  if (GameState.playerHand.length === 0) {
    winner = 'player';
  } else if (GameState.aiHand.length === 0) {
    winner = 'ai';
  }
  
  if (winner) {
    GameState.winner = winner;
    GameState.gameStatus = 'gameover';
    
    // Calculate round points
    const points = calculateRoundPoints(winner === 'player' ? GameState.aiHand : GameState.playerHand);
    
    if (winner === 'player') {
      GameState.playerScore += points;
    } else {
      GameState.aiScore += points;
    }
  }
  
  return {
    won: winner !== null,
    winner,
    points: winner ? calculateRoundPoints(winner === 'player' ? GameState.aiHand : GameState.playerHand) : 0
  };
}

/**
 * Calculate points for remaining hand
 * @param {Array} hand - Hand to calculate points for
 * @returns {number} Total points
 */
function calculateRoundPoints(hand) {
  return hand.reduce((total, card) => total + card.points, 0);
}

/**
 * Check if game is over (someone reached 500 points)
 * @returns {Object} Game over status and winner
 */
function checkGameOver() {
  if (GameState.playerScore >= 500) {
    return { gameOver: true, winner: 'player', reason: 'score' };
  }
  if (GameState.aiScore >= 500) {
    return { gameOver: true, winner: 'ai', reason: 'score' };
  }
  return { gameOver: false };
}

// ============================================
// GAME FLOW CONTROL
// ============================================

/**
 * Start a new round
 * @returns {Object} New game state
 */
function startNewRound() {
  const state = initGame();
  return state;
}

/**
 * Start new game (reset scores)
 * @returns {Object} New game state
 */
function startNewGame() {
  GameState.playerScore = 0;
  GameState.aiScore = 0;
  return startNewRound();
}

/**
 * Get current game state for UI
 * @returns {Object} Sanitized game state
 */
function getGameState() {
  return {
    playerHand: GameState.playerHand,
    aiHand: GameState.aiHand.map(() => ({ hidden: true })), // Hide AI cards
    aiHandCount: GameState.aiHand.length,
    discardPile: GameState.discardPile,
    topCard: GameState.discardPile[GameState.discardPile.length - 1],
    currentColor: GameState.currentColor,
    currentPlayer: GameState.currentPlayer,
    gameDirection: GameState.gameDirection,
    gameStatus: GameState.gameStatus,
    winner: GameState.winner,
    playerScore: GameState.playerScore,
    aiScore: GameState.aiScore,
    unoCalled: GameState.unoCalled,
    drawStack: GameState.drawStack,
    deckCount: GameState.deck.length
  };
}

// ============================================
// EXPORT FOR MODULE USE
// ============================================

// Export functions for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameState,
    createDeck,
    shuffleDeck,
    dealCards,
    initGame,
    isValidMove,
    getValidMoves,
    playCard,
    drawCard,
    aiTurn,
    callUNO,
    checkWin,
    checkGameOver,
    startNewRound,
    startNewGame,
    getGameState,
    calculateRoundPoints
  };
}

// Console log for debugging
console.log('🎴 UNO Game Logic Loaded - Matrix Theme');
console.log('🎮 Call startNewGame() to begin!');
