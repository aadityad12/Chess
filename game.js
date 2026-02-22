(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const detailEl = document.getElementById("detail");
  const controlsEl = document.querySelector(".controls");
  const sideSelect = document.getElementById("player-side");
  const diffSelect = document.getElementById("difficulty");
  const newGameBtn = document.getElementById("new-game-btn");
  let forfeitBtn = document.getElementById("forfeit-btn");
  const difficultyInfoEl = document.getElementById("difficulty-info");
  const eloComparisonEl = document.getElementById("elo-comparison");

  const PIECE_UNICODE = {
    wp: "♙",
    wn: "♘",
    wb: "♗",
    wr: "♖",
    wq: "♕",
    wk: "♔",
    bp: "♟",
    bn: "♞",
    bb: "♝",
    br: "♜",
    bq: "♛",
    bk: "♚",
  };

  const PIECE_VALUE = {
    p: 100,
    n: 320,
    b: 335,
    r: 500,
    q: 900,
    k: 20000,
  };

  const DIFFICULTY = [
    { label: "Very Easy", elo: 100, depth: 0, topPool: 999, blunder: 0.72 },
    { label: "Easy", elo: 300, depth: 1, topPool: 10, blunder: 0.6 },
    { label: "Beginner", elo: 500, depth: 1, topPool: 8, blunder: 0.5 },
    { label: "Novice", elo: 700, depth: 1, topPool: 5, blunder: 0.36 },
    { label: "Casual", elo: 900, depth: 1, topPool: 3, blunder: 0.24 },
    { label: "Average Club", elo: 1100, depth: 2, topPool: 8, blunder: 0.2 },
    { label: "Intermediate", elo: 1300, depth: 2, topPool: 5, blunder: 0.12 },
    { label: "Advanced", elo: 1500, depth: 2, topPool: 2, blunder: 0.08 },
    { label: "Expert", elo: 1700, depth: 3, topPool: 3, blunder: 0.03 },
    { label: "Master", elo: 1900, depth: 3, topPool: 1, blunder: 0 },
  ];

  const KNIGHT_DELTAS = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  const KING_DELTAS = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  const state = {
    position: null,
    selected: null,
    legalTargets: [],
    humanSide: "w",
    botSide: "b",
    difficulty: 5,
    hasStarted: false,
    gameOver: false,
    message: "",
    detail: "",
    lastMove: null,
    pendingBotAt: null,
    realtime: 0,
    inCheck: { w: false, b: false },
    drag: null,
    suppressClickUntil: 0,
  };

  let rafLastTs = null;

  setupDifficultySelect();
  ensureForfeitButton();
  renderDifficultyComparison();
  wireEvents();
  resetToIdle();
  requestAnimationFrame(loop);

  function setupDifficultySelect() {
    DIFFICULTY.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx + 1);
      opt.textContent = `${d.elo} Elo - ${d.label}`;
      if (idx === 5) {
        opt.selected = true;
      }
      diffSelect.appendChild(opt);
    });
  }

  function wireEvents() {
    newGameBtn.addEventListener("click", startNewGame);
    if (forfeitBtn) {
      forfeitBtn.addEventListener("click", forfeitGame);
    }
    diffSelect.addEventListener("change", () => {
      state.difficulty = Number(diffSelect.value);
      updateDifficultyInfo();
      updateStatusText();
    });

    boardEl.addEventListener("pointerdown", (event) => {
      const square = event.target.closest(".square");
      if (!square) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      onSquarePointerDown(Number(square.dataset.row), Number(square.dataset.col), event);
    });

    boardEl.addEventListener("click", (event) => {
      if (performance.now() < state.suppressClickUntil || state.drag) {
        return;
      }
      const square = event.target.closest(".square");
      if (!square) {
        return;
      }
      onSquareClick(Number(square.dataset.row), Number(square.dataset.col));
    });

    window.addEventListener("pointermove", onGlobalPointerMove, { passive: false });
    window.addEventListener("pointerup", onGlobalPointerUp, { passive: false });
    window.addEventListener("pointercancel", onGlobalPointerCancel, { passive: false });

    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    });
  }

  function ensureForfeitButton() {
    if (forfeitBtn || !controlsEl) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "forfeit-btn";
    btn.type = "button";
    btn.textContent = "Forfeit";
    controlsEl.appendChild(btn);
    forfeitBtn = btn;
  }

  function startNewGame() {
    clearDragState();
    const selected = sideSelect.value;
    state.humanSide =
      selected === "random" ? (Math.random() > 0.5 ? "w" : "b") : selected;
    state.botSide = opposite(state.humanSide);
    state.position = createInitialPosition();
    state.selected = null;
    state.legalTargets = [];
    state.hasStarted = true;
    state.gameOver = false;
    state.message = "Game started.";
    state.detail = "";
    state.lastMove = null;
    state.pendingBotAt = null;
    state.inCheck = { w: false, b: false };
    state.difficulty = Number(diffSelect.value);
    boardEl.classList.toggle("flipped", state.humanSide === "b");
    renderBoard();
    updateStatusText();
    scheduleBotIfNeeded(220);
  }

  function resetToIdle() {
    clearDragState();
    state.position = createInitialPosition();
    state.selected = null;
    state.legalTargets = [];
    state.hasStarted = false;
    state.gameOver = false;
    state.message = "Press New Game to start.";
    state.detail = "Choose side and difficulty first.";
    state.lastMove = null;
    state.pendingBotAt = null;
    state.inCheck = { w: false, b: false };
    state.difficulty = Number(diffSelect.value);
    boardEl.classList.remove("flipped");
    renderBoard();
    updateDifficultyInfo();
    updateStatusText();
  }

  function renderDifficultyComparison() {
    if (!eloComparisonEl) {
      return;
    }
    eloComparisonEl.replaceChildren();
    DIFFICULTY.forEach((level) => {
      const item = document.createElement("li");
      item.textContent = `${level.elo} Elo - ${level.label}`;
      eloComparisonEl.appendChild(item);
    });
  }

  function updateDifficultyInfo() {
    if (!difficultyInfoEl) {
      return;
    }
    const level = DIFFICULTY[Math.max(0, Math.min(9, state.difficulty - 1))];
    difficultyInfoEl.textContent = `Selected: ${level.elo} Elo - ${level.label}`;
  }

  function forfeitGame() {
    if (!state.hasStarted || state.gameOver) {
      return;
    }
    clearDragState();
    state.selected = null;
    state.legalTargets = [];
    state.pendingBotAt = null;
    state.gameOver = true;
    state.message = `${state.botSide === "w" ? "White" : "Black"} wins by forfeit.`;
    state.detail = "You forfeited. Press New Game for a rematch.";
    renderBoard();
    updateStatusText();
  }

  function createInitialPosition() {
    return {
      board: [
        ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
        Array(8).fill("bp"),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill("wp"),
        ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
      ],
      turn: "w",
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      halfmove: 0,
      fullmove: 1,
    };
  }

  function onSquareClick(row, col) {
    if (state.drag) {
      return;
    }
    if (
      !state.hasStarted ||
      state.gameOver ||
      !state.position ||
      state.position.turn !== state.humanSide
    ) {
      return;
    }
    const piece = state.position.board[row][col];

    if (state.selected) {
      const valid = state.legalTargets.find((m) => m.to.row === row && m.to.col === col);
      if (valid) {
        playMove(valid, true);
        return;
      }
    }

    if (!piece || piece[0] !== state.humanSide) {
      state.selected = null;
      state.legalTargets = [];
      renderBoard();
      return;
    }

    state.selected = { row, col };
    state.legalTargets = generateLegalMoves(state.position, state.humanSide).filter(
      (m) => m.from.row === row && m.from.col === col
    );
    renderBoard();
  }

  function onSquarePointerDown(row, col, event) {
    if (
      !state.hasStarted ||
      state.gameOver ||
      !state.position ||
      state.position.turn !== state.humanSide
    ) {
      return;
    }

    const piece = state.position.board[row][col];
    if (!piece || piece[0] !== state.humanSide) {
      return;
    }

    const legalFromSquare = generateLegalMoves(state.position, state.humanSide).filter(
      (m) => m.from.row === row && m.from.col === col
    );
    if (!legalFromSquare.length) {
      return;
    }

    state.selected = { row, col };
    state.legalTargets = legalFromSquare;
    renderBoard();

    const ghost = createDragGhost(piece);
    if (!ghost) {
      return;
    }

    state.drag = {
      pointerId: event.pointerId,
      from: { row, col },
      legalMoves: legalFromSquare,
      ghostEl: ghost,
    };
    moveDragGhost(event.clientX, event.clientY);
    const sourcePiece = getSquareElement(row, col)?.querySelector(".piece");
    if (sourcePiece) {
      sourcePiece.classList.add("drag-hidden");
    }
    state.suppressClickUntil = performance.now() + 250;
    event.preventDefault();
  }

  function onGlobalPointerMove(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }
    moveDragGhost(event.clientX, event.clientY);
    event.preventDefault();
  }

  function onGlobalPointerUp(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }
    completeDrag(event.clientX, event.clientY);
    event.preventDefault();
  }

  function onGlobalPointerCancel(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }
    clearDragState();
    state.selected = null;
    state.legalTargets = [];
    renderBoard();
    state.suppressClickUntil = performance.now() + 150;
    event.preventDefault();
  }

  function createDragGhost(piece) {
    const ghost = document.createElement("span");
    ghost.className = `piece drag-ghost ${piece[0] === "w" ? "piece-white" : "piece-black"}`;
    ghost.textContent = PIECE_UNICODE[piece];
    document.body.appendChild(ghost);
    return ghost;
  }

  function moveDragGhost(clientX, clientY) {
    if (!state.drag || !state.drag.ghostEl) {
      return;
    }
    state.drag.ghostEl.style.left = `${clientX}px`;
    state.drag.ghostEl.style.top = `${clientY}px`;
  }

  function completeDrag(clientX, clientY) {
    const drag = state.drag;
    if (!drag) {
      return;
    }

    const dropSquare = getSquareFromPoint(clientX, clientY);
    const move = dropSquare
      ? drag.legalMoves.find((m) => m.to.row === dropSquare.row && m.to.col === dropSquare.col)
      : null;

    clearDragState();
    state.suppressClickUntil = performance.now() + 200;

    if (move) {
      playMove(move, true);
      return;
    }

    state.selected = null;
    state.legalTargets = [];
    renderBoard();
    updateStatusText();
  }

  function getSquareFromPoint(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    const square = target ? target.closest(".square") : null;
    if (!square) {
      return null;
    }
    return { row: Number(square.dataset.row), col: Number(square.dataset.col) };
  }

  function clearDragState() {
    if (state.drag?.ghostEl && state.drag.ghostEl.parentNode) {
      state.drag.ghostEl.parentNode.removeChild(state.drag.ghostEl);
    }
    state.drag = null;
  }

  function playMove(move, isHumanMove) {
    const movingPiece = state.position.board[move.from.row][move.from.col];
    const fromRect = getSquareRect(move.from.row, move.from.col);
    state.position = applyMove(state.position, move);
    state.selected = null;
    state.legalTargets = [];
    state.lastMove = move;
    state.inCheck.w = isInCheck(state.position, "w");
    state.inCheck.b = isInCheck(state.position, "b");

    evaluateTerminalState();
    renderBoard();

    const toRect = getSquareRect(move.to.row, move.to.col);
    if (movingPiece && fromRect && toRect) {
      animatePieceEntry(move.to.row, move.to.col, fromRect, toRect);
    }

    if (!state.gameOver) {
      scheduleBotIfNeeded(isHumanMove ? 320 : 160);
      updateStatusText();
    }
  }

  function evaluateTerminalState() {
    const legal = generateLegalMoves(state.position, state.position.turn);
    if (legal.length > 0) {
      state.gameOver = false;
      return;
    }

    state.gameOver = true;
    if (isInCheck(state.position, state.position.turn)) {
      const winner = opposite(state.position.turn);
      state.message = `${winner === "w" ? "White" : "Black"} wins by checkmate.`;
    } else {
      state.message = "Draw by stalemate.";
    }
    state.detail = "Press New Game for a rematch.";
    state.pendingBotAt = null;
  }

  function scheduleBotIfNeeded(delayMs) {
    if (state.hasStarted && !state.gameOver && state.position.turn === state.botSide) {
      state.pendingBotAt = state.realtime + delayMs;
      state.message = "Bot is thinking...";
      updateStatusText();
    } else {
      state.pendingBotAt = null;
    }
  }

  function loop(ts) {
    if (rafLastTs == null) {
      rafLastTs = ts;
    }
    const delta = Math.min(60, ts - rafLastTs);
    rafLastTs = ts;
    step(delta);
    requestAnimationFrame(loop);
  }

  function step(ms) {
    state.realtime += ms;
    if (
      state.pendingBotAt != null &&
      state.realtime >= state.pendingBotAt &&
      !state.gameOver &&
      state.position.turn === state.botSide
    ) {
      state.pendingBotAt = null;
      const move = chooseBotMove();
      if (move) {
        playMove(move, false);
      }
    }
  }

  function chooseBotMove() {
    const legal = generateLegalMoves(state.position, state.botSide);
    if (!legal.length) {
      return null;
    }

    const cfg = DIFFICULTY[Math.max(0, Math.min(9, state.difficulty - 1))];
    if (cfg.depth === 0) {
      return legal[Math.floor(Math.random() * legal.length)];
    }

    const scored = legal.map((move) => {
      const next = applyMove(state.position, move);
      const score = minimax(next, cfg.depth - 1, -Infinity, Infinity, state.botSide);
      return { move, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (Math.random() < cfg.blunder && scored.length > 2) {
      const from = Math.floor(scored.length * 0.45);
      const idx = from + Math.floor(Math.random() * Math.max(1, scored.length - from));
      return scored[idx].move;
    }

    const pool = Math.min(cfg.topPool, scored.length);
    return scored[Math.floor(Math.random() * pool)].move;
  }

  function minimax(position, depth, alpha, beta, maximizeFor) {
    const legal = generateLegalMoves(position, position.turn);
    if (depth <= 0 || !legal.length) {
      return evaluatePosition(position, maximizeFor, legal.length === 0);
    }

    const isMaximizing = position.turn === maximizeFor;
    if (isMaximizing) {
      let best = -Infinity;
      for (const move of orderMoves(position, legal)) {
        const value = minimax(applyMove(position, move), depth - 1, alpha, beta, maximizeFor);
        best = Math.max(best, value);
        alpha = Math.max(alpha, best);
        if (beta <= alpha) {
          break;
        }
      }
      return best;
    }

    let best = Infinity;
    for (const move of orderMoves(position, legal)) {
      const value = minimax(applyMove(position, move), depth - 1, alpha, beta, maximizeFor);
      best = Math.min(best, value);
      beta = Math.min(beta, best);
      if (beta <= alpha) {
        break;
      }
    }
    return best;
  }

  function orderMoves(position, moves) {
    return [...moves].sort((a, b) => moveScore(position, b) - moveScore(position, a));
  }

  function moveScore(position, move) {
    const attacker = position.board[move.from.row][move.from.col];
    const victim =
      move.isEnPassant
        ? position.board[move.from.row][move.to.col]
        : position.board[move.to.row][move.to.col];
    let score = 0;
    if (victim) {
      score += PIECE_VALUE[victim[1]] * 12 - PIECE_VALUE[attacker[1]];
    }
    if (move.promotion) {
      score += 800;
    }
    if (move.isCastle) {
      score += 45;
    }
    return score;
  }

  function evaluatePosition(position, perspective, terminal) {
    if (terminal) {
      if (isInCheck(position, position.turn)) {
        return position.turn === perspective ? -100000 : 100000;
      }
      return 0;
    }

    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = position.board[row][col];
        if (!piece) {
          continue;
        }
        const color = piece[0];
        const type = piece[1];
        const base = PIECE_VALUE[type];
        const centrality = 14 - Math.abs(3.5 - row) * 2 - Math.abs(3.5 - col) * 2;
        const mobilityHint = type === "n" || type === "b" || type === "q" ? centrality : centrality * 0.45;
        const bonus = type === "p" ? (color === "w" ? (6 - row) * 6 : (row - 1) * 6) : mobilityHint;
        const signed = color === "w" ? base + bonus : -(base + bonus);
        score += signed;
        if (piece === "wb") whiteBishops += 1;
        if (piece === "bb") blackBishops += 1;
      }
    }

    if (whiteBishops >= 2) score += 30;
    if (blackBishops >= 2) score -= 30;

    const mobility = generateLegalMoves(position, position.turn).length;
    score += (position.turn === "w" ? 1 : -1) * mobility * 2;

    return perspective === "w" ? score : -score;
  }

  function generateLegalMoves(position, color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = position.board[row][col];
        if (!piece || piece[0] !== color) {
          continue;
        }
        const pseudo = generatePseudoMoves(position, row, col, false);
        for (const move of pseudo) {
          const next = applyMove(position, move);
          if (!isInCheck(next, color)) {
            moves.push(move);
          }
        }
      }
    }
    return moves;
  }

  function generatePseudoMoves(position, row, col, attacksOnly) {
    const piece = position.board[row][col];
    if (!piece) {
      return [];
    }
    const color = piece[0];
    const enemy = opposite(color);
    const type = piece[1];
    const moves = [];

    if (type === "p") {
      const direction = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const promotionRow = color === "w" ? 0 : 7;

      const oneStep = row + direction;
      if (!attacksOnly && inBounds(oneStep, col) && !position.board[oneStep][col]) {
        moves.push({ from: { row, col }, to: { row: oneStep, col }, promotion: oneStep === promotionRow ? "q" : null });
        const twoStep = row + direction * 2;
        if (row === startRow && !position.board[twoStep][col]) {
          moves.push({ from: { row, col }, to: { row: twoStep, col }, promotion: null });
        }
      }

      for (const deltaCol of [-1, 1]) {
        const targetRow = row + direction;
        const targetCol = col + deltaCol;
        if (!inBounds(targetRow, targetCol)) {
          continue;
        }
        const targetPiece = position.board[targetRow][targetCol];
        if (targetPiece && targetPiece[0] === enemy) {
          moves.push({
            from: { row, col },
            to: { row: targetRow, col: targetCol },
            promotion: targetRow === promotionRow ? "q" : null,
          });
        }

        if (
          !attacksOnly &&
          position.enPassant &&
          position.enPassant.row === targetRow &&
          position.enPassant.col === targetCol &&
          position.enPassant.pawnColor === enemy
        ) {
          moves.push({
            from: { row, col },
            to: { row: targetRow, col: targetCol },
            promotion: null,
            isEnPassant: true,
          });
        }
      }
      return moves;
    }

    if (type === "n") {
      for (const [dr, dc] of KNIGHT_DELTAS) {
        pushTarget(position, moves, row, col, row + dr, col + dc, color);
      }
      return moves;
    }

    if (type === "k") {
      for (const [dr, dc] of KING_DELTAS) {
        pushTarget(position, moves, row, col, row + dr, col + dc, color);
      }

      if (!attacksOnly && !isInCheck(position, color)) {
        const homeRow = color === "w" ? 7 : 0;
        if (row === homeRow && col === 4) {
          if (
            canCastle(position, color, "K") &&
            !position.board[homeRow][5] &&
            !position.board[homeRow][6] &&
            !isSquareAttacked(position, homeRow, 5, enemy) &&
            !isSquareAttacked(position, homeRow, 6, enemy)
          ) {
            moves.push({ from: { row, col }, to: { row: homeRow, col: 6 }, isCastle: true, castleSide: "K" });
          }
          if (
            canCastle(position, color, "Q") &&
            !position.board[homeRow][1] &&
            !position.board[homeRow][2] &&
            !position.board[homeRow][3] &&
            !isSquareAttacked(position, homeRow, 2, enemy) &&
            !isSquareAttacked(position, homeRow, 3, enemy)
          ) {
            moves.push({ from: { row, col }, to: { row: homeRow, col: 2 }, isCastle: true, castleSide: "Q" });
          }
        }
      }
      return moves;
    }

    const lines = [];
    if (type === "b" || type === "q") {
      lines.push(
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      );
    }
    if (type === "r" || type === "q") {
      lines.push(
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      );
    }

    for (const [dr, dc] of lines) {
      let rr = row + dr;
      let cc = col + dc;
      while (inBounds(rr, cc)) {
        const target = position.board[rr][cc];
        if (!target) {
          moves.push({ from: { row, col }, to: { row: rr, col: cc } });
        } else {
          if (target[0] !== color) {
            moves.push({ from: { row, col }, to: { row: rr, col: cc } });
          }
          break;
        }
        rr += dr;
        cc += dc;
      }
    }

    return moves;
  }

  function pushTarget(position, moves, fromRow, fromCol, toRow, toCol, color) {
    if (!inBounds(toRow, toCol)) {
      return;
    }
    const target = position.board[toRow][toCol];
    if (!target || target[0] !== color) {
      moves.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
    }
  }

  function isSquareAttacked(position, row, col, byColor) {
    for (let rr = 0; rr < 8; rr++) {
      for (let cc = 0; cc < 8; cc++) {
        const piece = position.board[rr][cc];
        if (!piece || piece[0] !== byColor) {
          continue;
        }
        const type = piece[1];

        if (type === "p") {
          const dir = byColor === "w" ? -1 : 1;
          if (rr + dir === row && Math.abs(cc - col) === 1) {
            return true;
          }
          continue;
        }

        if (type === "k") {
          if (Math.abs(rr - row) <= 1 && Math.abs(cc - col) <= 1) {
            return true;
          }
          continue;
        }

        const pseudo = generatePseudoMoves(position, rr, cc, true);
        if (pseudo.some((m) => m.to.row === row && m.to.col === col)) {
          return true;
        }
      }
    }
    return false;
  }

  function isInCheck(position, color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = position.board[row][col];
        if (piece === `${color}k`) {
          return isSquareAttacked(position, row, col, opposite(color));
        }
      }
    }
    return false;
  }

  function canCastle(position, color, side) {
    return position.castling[`${color}${side}`];
  }

  function applyMove(position, move) {
    const next = {
      board: position.board.map((row) => [...row]),
      turn: opposite(position.turn),
      castling: { ...position.castling },
      enPassant: null,
      halfmove: position.halfmove + 1,
      fullmove: position.fullmove + (position.turn === "b" ? 1 : 0),
    };

    let piece = next.board[move.from.row][move.from.col];
    next.board[move.from.row][move.from.col] = null;

    const capturedPiece =
      move.isEnPassant
        ? next.board[move.from.row][move.to.col]
        : next.board[move.to.row][move.to.col];

    if (move.isEnPassant) {
      next.board[move.from.row][move.to.col] = null;
    }

    if (move.isCastle && piece && piece[1] === "k") {
      const row = move.from.row;
      if (move.castleSide === "K") {
        next.board[row][5] = next.board[row][7];
        next.board[row][7] = null;
      } else {
        next.board[row][3] = next.board[row][0];
        next.board[row][0] = null;
      }
    }

    if (piece && piece[1] === "p") {
      next.halfmove = 0;
      const double = Math.abs(move.from.row - move.to.row) === 2;
      if (double) {
        next.enPassant = {
          row: (move.from.row + move.to.row) / 2,
          col: move.from.col,
          pawnColor: piece[0],
        };
      }
      if (move.promotion) {
        piece = `${piece[0]}${move.promotion}`;
      }
    }

    if (capturedPiece) {
      next.halfmove = 0;
    }

    next.board[move.to.row][move.to.col] = piece;

    if (piece === "wk") {
      next.castling.wK = false;
      next.castling.wQ = false;
    }
    if (piece === "bk") {
      next.castling.bK = false;
      next.castling.bQ = false;
    }

    if (move.from.row === 7 && move.from.col === 0) next.castling.wQ = false;
    if (move.from.row === 7 && move.from.col === 7) next.castling.wK = false;
    if (move.from.row === 0 && move.from.col === 0) next.castling.bQ = false;
    if (move.from.row === 0 && move.from.col === 7) next.castling.bK = false;

    if (move.to.row === 7 && move.to.col === 0) next.castling.wQ = false;
    if (move.to.row === 7 && move.to.col === 7) next.castling.wK = false;
    if (move.to.row === 0 && move.to.col === 0) next.castling.bQ = false;
    if (move.to.row === 0 && move.to.col === 7) next.castling.bK = false;

    return next;
  }

  function renderBoard() {
    boardEl.replaceChildren();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement("button");
        square.type = "button";
        square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
        square.dataset.row = String(row);
        square.dataset.col = String(col);

        if (state.selected && state.selected.row === row && state.selected.col === col) {
          square.classList.add("selected");
        }

        if (state.legalTargets.some((m) => m.to.row === row && m.to.col === col)) {
          square.classList.add("target");
        }

        if (state.lastMove) {
          if (state.lastMove.from.row === row && state.lastMove.from.col === col) {
            square.classList.add("last-from");
          }
          if (state.lastMove.to.row === row && state.lastMove.to.col === col) {
            square.classList.add("last-to");
          }
        }

        if (state.inCheck.w && state.position.board[row][col] === "wk") {
          square.classList.add("in-check");
        }
        if (state.inCheck.b && state.position.board[row][col] === "bk") {
          square.classList.add("in-check");
        }

        const piece = state.position.board[row][col];
        if (piece) {
          const pieceEl = document.createElement("span");
          pieceEl.className = `piece ${piece[0] === "w" ? "piece-white" : "piece-black"}`;
          if (state.drag && state.drag.from.row === row && state.drag.from.col === col) {
            pieceEl.classList.add("drag-hidden");
          }
          pieceEl.textContent = PIECE_UNICODE[piece];
          square.appendChild(pieceEl);
        }

        boardEl.appendChild(square);
      }
    }
  }

  function animatePieceEntry(row, col, fromRect, toRect) {
    const targetSquare = getSquareElement(row, col);
    if (!targetSquare) {
      return;
    }
    const pieceEl = targetSquare.querySelector(".piece");
    if (!pieceEl) {
      return;
    }
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    pieceEl.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.08)` },
        { transform: "translate(0, 0) scale(1.03)", offset: 0.72 },
        { transform: "translate(0, 0) scale(1)" },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      }
    );
  }

  function getSquareRect(row, col) {
    const sq = getSquareElement(row, col);
    return sq ? sq.getBoundingClientRect() : null;
  }

  function getSquareElement(row, col) {
    return boardEl.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
  }

  function updateStatusText() {
    const level = DIFFICULTY[Math.max(0, Math.min(9, state.difficulty - 1))];

    if (!state.hasStarted) {
      statusEl.textContent = "Press New Game to start.";
      detailEl.textContent = `Current bot: ${level.elo} Elo - ${level.label}. Choose side and start when ready.`;
      return;
    }

    const turnText = state.position.turn === "w" ? "White" : "Black";
    const humanText = state.humanSide === "w" ? "White" : "Black";

    if (state.gameOver) {
      statusEl.textContent = state.message;
      detailEl.textContent = state.detail;
      return;
    }

    statusEl.textContent = state.message || `${turnText} to move.`;

    const checkFlag =
      (state.position.turn === "w" && state.inCheck.w) ||
      (state.position.turn === "b" && state.inCheck.b)
        ? " | Check"
        : "";

    detailEl.textContent = `You: ${humanText} | Turn: ${turnText}${checkFlag} | Bot: ${level.elo} Elo - ${level.label}`;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    document.exitFullscreen().catch(() => {});
  }

  function inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  function opposite(color) {
    return color === "w" ? "b" : "w";
  }

  window.render_game_to_text = () => {
    const payload = {
      coordinate_system:
        "row 0 is top (black home rank), row 7 bottom (white home rank); col 0 is left from white's view",
      mode: state.hasStarted ? (state.gameOver ? "game_over" : "playing") : "idle",
      has_started: state.hasStarted,
      human_side: state.humanSide,
      bot_side: state.botSide,
      turn: state.position.turn,
      difficulty: state.difficulty,
      message: statusEl.textContent,
      detail: detailEl.textContent,
      selected: state.selected,
      legal_targets: state.legalTargets.map((m) => m.to),
      last_move: state.lastMove,
      in_check: state.inCheck,
      pending_bot_move: state.pendingBotAt != null,
      pieces: [],
    };

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = state.position.board[row][col];
        if (piece) {
          payload.pieces.push({ piece, row, col });
        }
      }
    }

    return JSON.stringify(payload);
  };

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const delta = ms / steps;
    for (let i = 0; i < steps; i++) {
      step(delta);
    }
    renderBoard();
    updateStatusText();
  };
})();
