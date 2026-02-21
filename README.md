# Chess Game

A browser-based chess game with:
- 3D-style board and piece movement animation
- Bot opponent with 10 difficulty levels
- Side selection: `White`, `Black`, or `Random`

## Run Locally

### Option 1 (recommended): Python static server
```bash
cd /Users/aadityad/Desktop/Aaditya/Personal/ExtraCuricular/Projects/chess-game
python3 -m http.server 5173
```
Open: `http://127.0.0.1:5173`

### Option 2: Open directly
Open `index.html` in your browser.

## How to Play
- Click `New Game`
- Choose your side and bot difficulty first
- Click a piece, then click a highlighted destination square
- Press `f` to toggle fullscreen

## Current Scope / Expectations
- Rules implemented: legal moves, check, checkmate, stalemate, castling, en passant
- Pawn promotion currently auto-promotes to a queen
- Bot strength varies across 10 levels using minimax + randomness profiles
- UI includes estimated Elo ranges for each difficulty level (approximate)
- Board flips automatically when you play as black

## Project Files
- `index.html`: layout and controls
- `style.css`: visuals and 3D styling
- `game.js`: chess logic, rendering, bot, interaction
- `progress.md`: implementation notes and validation log

## Known Limitations
- No move history/undo yet
- No user choice for underpromotion yet (rook/bishop/knight)
- Playwright automation file exists (`web_game_playwright_client.mjs`), but dependency installation may require network access in your environment
