# TODO overall:


# TODO for index:



# TODO for upload:

- Don't allow videos longer than 2 seconds.

- If an iPhone user turns their live photo into a bouncing video, then throw away the second half.

- Allow cropping

- Preview the currently selected range and crop bouncing (to help make smooth bounces)


# TODO for puzzle:

- Add a loading screen

- Reactive-zoom the screen upon drop to always have 0.5 row/col empty on all sides (and allow dragging into that half row/col)
  - Should we change the x/y of every piece when this happens?  Or should we have 3 coordinate systems: SourceXY, StageXY, ScreenXY?
  - Rendering will use ScreenXY, clobbering will use StageXY, glueing will use SourceRowCol+StageRowCol, dragging will be a mess.

- Send video from server -> client more efficiently.  viv-slide is 800KB as mov and 10MB as 47 jpgs.
  - We cannot play from a `<video>` because that can't reverse-play the bounce and encoding the bounce into the video will double size.
  - We can add frames to the puzzle after it has started by modifying `animatedSprite.textures` (https://www.html5gamedevs.com/topic/28818-how-to-update-texture-for-animatedsprite)
  - Build this as an option (`&vid=1`) and enable for compatible browsers
  - Option 1: use a js video decoder to convert video -> frames
    - jsmpeg only handles inefficient mpeg1
    - look into bellard's BPG: https://bellard.org/bpg/animation.html
  - Option 2: use `<video>` & `<canvas>` to convert video -> frames (at what speed? realtime?)
  - Option 3: some other compression method

- Allow adding a border with `&border=true`

- Add a quadratic-to-linear bouncetype with configurable quadratic duration.


# CONSIDER-TODO for puzzle:

- `grid.setSquarePos(squareID, col, row)`, `grid.getSquare(col, row)`, `grid.size`? with separate groundedGrid vs heldGrid?
- When dragging a group of pieces, show a shadow behind them (but above non-held pieces)
- Show rectangles instead of squares to fill the screen?
- Rotate pieces - Tap an edge to point it up? Drag a corner (shown on hover)? Drag across rotator-zone? Right-click? Shake? Two-finger? Or don't?
