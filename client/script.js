/* global PIXI, _ */

// Note: the image must be served via http* due to CORS.

// TODO:
// + `grid.setSquarePos(squareID, col, row)`, `grid.getSquare(col, row)`, `grid.size`
// + Let user choose minNumPieces, either with `?pieces=500` in URL or with input box.
// + When picking up a piece, also pick up correct neighbors (and their correct neighbors, etc)

// LATER:
// + When dragging a group of pieces, show a shadow behind them (but above non-held pieces)
// + Let users upload images (perhaps with password required)
// + Rotate pieces - Tap an edge to point it up? Drag a corner (shown on hover)? Drag across rotator-zone? Right-click? Shake? Two-finger? Or don't?
// + Add sync?
// + Show a border between misaligned pieces?


window._d = window._d || {}; // for debugging in browser console

const squareIDRowMultiplier = 10000; // Never do a puzzle with 10001 or more columns
const getSquareID = function(row, column) {
  return row * squareIDRowMultiplier + column;
};


const app = new PIXI.Application({
  backgroundColor:0x444444,
  width:window.innerWidth - 3, height:window.innerHeight - 10,
});
app.stage.sortableChildren = true; // required for zIndex to have any effect
document.body.appendChild(app.view);
const imgPaths = _.range(1, 1+47).map(i => `https://petervh.com/viv-frames/${i}.jpg`);

imgPaths.forEach(imgPath => app.loader.add(imgPath));
app.loader.load(function() {

  const baseTextures = imgPaths.map(imgPath => PIXI.BaseTexture.from(imgPath));
  const firstBaseTexture = baseTextures[0];
  // TODO: assert that all baseTextures have the same width and height

  // Define the grid:
  // `sourceSquareSize` is the width and height of the square extracted from the input image (which is stored in `baseTexture`)
  // `screenSquareSize` is the width and height of the square drawn into the <canvas> (which is accessed via `app.screen`)
  const minNumPieces = 100;
  for(var sourceNumRows = 1;; sourceNumRows++) {
    var sourceSquareSize = Math.floor(firstBaseTexture.height / sourceNumRows);
    var sourceNumCols = Math.floor(firstBaseTexture.width / sourceSquareSize);
    const numPieces = sourceNumRows * sourceNumCols;
    if (numPieces > minNumPieces) {
      break;
    }
  }
  let screenSquareSize = app.screen.height / sourceNumRows;
  if (screenSquareSize * sourceNumCols > app.screen.width) {
    screenSquareSize = Math.floor(app.screen.width / sourceNumCols);
  }
  screenSquareSize *= 0.85; // shrink pieces a little to leave empty workspace
  let screenNumCols = Math.floor(app.screen.width / screenSquareSize);
  let screenNumRows = Math.floor(app.screen.height / screenSquareSize);
  screenSquareSize = Math.min(
    app.screen.width / screenNumCols,
    app.screen.height / screenNumRows
  );
  console.log(`${firstBaseTexture.width}x${firstBaseTexture.height}`, sourceSquareSize, '-', `${app.screen.width}x${app.screen.height}`, screenSquareSize);

  const sourceRowColPairs = Array.from(function* () {
    for (let colIdx = 0; (colIdx+1)*sourceSquareSize < firstBaseTexture.width; colIdx++) {
      for (let rowIdx = 0; (rowIdx+1)*sourceSquareSize < firstBaseTexture.height; rowIdx++) {
        yield [rowIdx, colIdx];
      }
    }
  }());
  const screenRowColPairs = Array.from(function* () {
    for (let colIdx = 0; (colIdx+1)*screenSquareSize < app.screen.width; colIdx++) {
      for (let rowIdx = 0; (rowIdx+1)*screenSquareSize < app.screen.height; rowIdx++) {
        yield [rowIdx, colIdx];
      }
    }
  }());
  function getXYFromRowCol(row, col) {
    return [0.5 * screenSquareSize + col * screenSquareSize, 0.5 * screenSquareSize + row * screenSquareSize];
  }
  const screenXYPairs = screenRowColPairs.map(([row,col]) => getXYFromRowCol(row, col));
  function getRowColFromXY(x, y) {
    x = _.clamp(x, 0, screenNumCols * screenSquareSize - 0.01);
    y = _.clamp(y, 0, screenNumRows * screenSquareSize - 0.01);
    return [Math.floor(y / screenSquareSize), Math.floor(x / screenSquareSize)];
  }

  // Initialize the squares:
  const squares = {}; window._d.squares = squares;
  for (let [rowIdx, colIdx] of sourceRowColPairs) {
    const squareID = getSquareID(rowIdx, colIdx);

    const textures = baseTextures.map(baseTexture => new PIXI.Texture(
      baseTexture,
      new PIXI.Rectangle(colIdx*sourceSquareSize, rowIdx*sourceSquareSize, sourceSquareSize, sourceSquareSize)
    ));
    textures.push(...textures.slice().reverse());

    const square = new PIXI.AnimatedSprite(textures);
    square.squareID = squareID;
    square.width = square.height = screenSquareSize;
    square.anchor.set(0.5);
    square.animationSpeed = 0.5;
    square.play();

    square.buttonMode = true; // show "hand" cursor when hovered
    square.interactive = true; // required for mouse/touch interaction
    square
      .on('pointerdown', onDragStart) // `pointer` catches both mouse and touch
      .on('pointerup', onDragEnd)
      .on('pointerupoutside', onDragEnd)
      .on('pointermove', onDragMove);

    squares[squareID] = square;
  }

  _.shuffle(Object.keys(squares)).forEach((squareID,idx) => {
    const square = squares[squareID];
    const [x, y] = screenXYPairs[idx];
    square.x = x;
    square.y = y;
    app.stage.addChild(square);
  });

  function onDragStart(event) {
    // Remember the offset from the center of the square to the pointer,
    //  because in onDragMove() we don't just want to center the square
    //  on the whever the pointer is.
    const square = this;
    const pointerPosition = event.data.getLocalPosition(square.parent);
    square.dragStartOffset = {
      x: pointerPosition.x - this.position.x,
      y: pointerPosition.y - this.position.y,
    };
    square.isDragging = true;
    square.zIndex = 1; // Show this square above non-held squares.  This requires 'this.parent.sortableChildren'.
  }
  function onDragMove(event) {
    const square = this;
    if (square.isDragging) {
      const pointerPosition = event.data.getLocalPosition(square.parent);
      var squarePosition = {
        x: pointerPosition.x - this.dragStartOffset.x,
        y: pointerPosition.y - this.dragStartOffset.y
      };
      [square.x, square.y] = getXYFromRowCol(...getRowColFromXY(squarePosition.x, squarePosition.y));
    }
  }
  function onDragEnd() {
    const square = this;
    square.isDragging = false;
    square.dragStartOffset = undefined;
    square.zIndex = 0;
    // Check if this piece covers any other piece
    // TODO: Make this not be O(n^2).  Maybe make a set of occupied XY before iterating squareXYPairs.
    _.each(squares, sq => {
      if (sq.squareID !== square.squareID && Math.abs(sq.x - square.x) < screenSquareSize/4 && Math.abs(sq.y - square.y) < screenSquareSize/4) {
        // Find an empty spot
        for (let [x, y] of screenXYPairs.slice().reverse()) {
          if (!_.some(squares, s => s.x === x && s.y === y)) {
            sq.x = x;
            sq.y = y;
            break;
          }
        }
      }
    });
  }
});
