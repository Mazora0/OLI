# QLO 1.3 Agent 2D Games Update

This update adds a strict credit-saving 2D games library to QLO 1.3 Agent.

## What changed

- Added a real local Canvas game engine for Agent game requests.
- Added ready playable games:
  - Snake
  - Pong
  - Breakout
  - Flappy
  - Dodge Blocks
  - Space Shooter
  - Target Clicker
  - Memory Cards
  - Tic Tac Toe
- Game requests now use the local game template first to save credits.
- If the requested game is not available in the template library, QLO 1.3 Agent falls back to normal AI generation.
- Output includes:
  - HTML preview
  - Single-file JSX wrapper
  - ZIP-ready project export from the chat UI
- Games support:
  - Keyboard controls
  - Mobile touch controls
  - Score
  - Lives
  - Local high score using localStorage
  - No external libraries for the game engine

## Credit-saving behavior

Game templates are generated locally by the server without a heavy AI call when the prompt matches known 2D game types. The Agent still customizes the project name, visual style, language, and labels from the user prompt.

