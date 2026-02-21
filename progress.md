Original prompt: help me create a chess board game
1. I would like there to be a 3d animation
2. I would like the bot to have varying difficulty 10 different levels
3. I should be able to decide to start as white, black or random

## Progress Log
- Created a new `chess-game` web app with `index.html`, `style.css`, and `game.js`.
- Implemented full board rendering, click-to-move controls, legal move generation, check/checkmate/stalemate detection, castling, en passant, and auto-queen promotion.
- Added a bot with 10 difficulty profiles using minimax + alpha-beta pruning with varying depth/randomness.
- Added side selection (`white`, `black`, `random`) and board orientation flip based on chosen side.
- Added 3D-styled board perspective and animated piece movement transitions.
- Exposed `window.render_game_to_text` and `window.advanceTime(ms)` for automated testing.

## TODO / Next Agent Notes
- Run Playwright client loop and inspect screenshots for visual clarity and interaction correctness.
- Verify no console errors and fix any issues found.
- Consider adding explicit promotion choice UI if user requests underpromotion.

## Validation Notes
- Syntax check passed: `node --check game.js`.
- Tried running the required Playwright client script, but environment has no npm network access (`ENOTFOUND registry.npmjs.org`) and no preinstalled `playwright` package.
- Started local server successfully (port 5173) and prepared Playwright command format, but full browser automation could not run due to missing Playwright dependency.
- Updated startup behavior: game now loads in idle state and does not display "Game started." until New Game is clicked.
- Added estimated Elo mapping UI for all 10 bot levels, including current selected level estimate.
- Updated README run path to start server from `chess-game/`.
