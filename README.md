# TODO for index:

- Make a 200x200 thumbnail for each puzzle and use it in the shared `info.json`.


# TODO for upload:

- Don't allow videos longer than 2 seconds.

- Cache upload password in localStorage.

- If an iPhone user turns their live photo into a bouncing video, then throw away the second half.

- Allow cropping

- Preview the currently selected range and crop bouncing (to help make smooth bounces)


# TODO for puzzle:

- Reactive-zoom the screen upon drop to always have 0.5 row/col empty on all sides (and allow dragging into that half row/col)
  - Should we change the x/y of every piece when this happens?  Or should we have 3 coordinate systems: SourceXY, StageXY, ScreenXY?
  - Rendering will use ScreenXY, clobbering will use StageXY, glueing will use SourceRowCol+StageRowCol, dragging will be a mess.

- On drop, save the state into localStorage.
  - Should serialization/deserialization be special functions?  Or should the entire state pass through an easily-serializable format, like cardtable does?
     - The difficulty with this is that we have to create the baseTextures.
         - What if I had a memoized getBaseTextureForURL(url) and getTexture(url, x,y,width,height)? (beware Pixi GC)
  - Add a dropdown-menu at the top-left with "Restart".

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


# CONSIDER-TODO for puzzle:

- `grid.setSquarePos(squareID, col, row)`, `grid.getSquare(col, row)`, `grid.size`? with separate groundedGrid vs heldGrid?
- When dragging a group of pieces, show a shadow behind them (but above non-held pieces)
- Show rectangles instead of squares to fill the screen?
- Rotate pieces - Tap an edge to point it up? Drag a corner (shown on hover)? Drag across rotator-zone? Right-click? Shake? Two-finger? Or don't?
