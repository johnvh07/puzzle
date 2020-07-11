/* global PIXI, _ */

// Note: the image must be served via http* due to CORS.

// TODO:
// + "Harry Potter" live image puzzle
// + Let user choose minNumPieces, either with `?pieces=500` in URL or with input box.

// LATER:
// + Select a group of pieces to drag? Or glue aligned pieces so that they move together (perhaps by combining into a SquareGroup)?
// + Let users upload images (perhaps with password required)
// + Rotate pieces - Tap an edge to point it up? Drag a corner (shown on hover)? Drag across rotator-zone? Right-click? Shake? Or don't?
// + Add sync



window._d = window._d || {}; // for debugging in browser console

function fmt(format) {
  // fmt("a {0} c {1}", "b", "d") === "a b c d"
  var args = Array.prototype.slice.call(arguments, 1);
  return format.replace(/{(\d+)}/g, function(match, number) {
    return (typeof args[number] != 'undefined') ? args[number] : match;
  });
}

function setObjectPath(obj, keyParts, value) {
  // Set `obj[keyParts[0]][keyParts[1]][keyParts[2]] = value`, for any number of keyParts
  if (keyParts.length === 0) { return; }
  if (typeof obj !== 'object') {
    throw 'cannot use setObjectPath() on non-object ${JSON.stringify(obj)}';
  }
  let o = obj;
  const nonFinalKeyParts = keyParts.slice(0, keyParts.length - 1);
  const finalKeyPart = keyParts[keyParts.length - 1];
  for (const keyPart of nonFinalKeyParts) {
    if (typeof o[keyPart] === 'undefined') {
      o[keyPart] = {};
    } else if (!_.isObject(o[keyPart])) {
      throw `setObject(${JSON.stringify(obj)}, ${JSON.stringify(keyParts)}, ${JSON.stringify(value)}) failed trying to sub-path to a non-object at key ${JSON.stringify(keyPart)} of ${JSON.stringify(o)}.`;
    }
    o = o[keyPart];
  }
  o[finalKeyPart] = value;
}

const squareIDRowMultiplier = 10000; // Never do a puzzle with 10001 or more columns
const getSquareID = function(row, column) {
  return row * squareIDRowMultiplier + column;
};
const getRowAndCol = _.memoize(function(squareID) {
  return [
    Math.floor(squareID / squareIDRowMultiplier),
    squareID % squareIDRowMultiplier
  ];
});
const getNeighbors = _.memoize(function(squareID) {
  // Given a squareID like `3004` (ie, row=3, column=4),
  // return the IDs of the squares above, below, and beside the square,
  // which are [2004, 3003, 3005, 4004].
  squareID = +squareID;
  const [row, col] = getRowAndCol(squareID);
  return [
    getSquareID(row-1, col),
    getSquareID(row, col-1),
    getSquareID(row, col+1),
    getSquareID(row+1, col),
  ];
});



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

  // `squareRawSize` is the width and height of the square extracted from the input image (which is stored in `baseTexture`)
  // `squareSize` is the width and height of the square drawn into the <canvas> (which is accessed via `app.screen`)
  const minNumPieces = 100;
  for(var numRows = 1;; numRows++) {
    var squareRawSize = Math.floor(firstBaseTexture.height / numRows);
    var numCols = Math.floor(firstBaseTexture.width / squareRawSize);
    const numPieces = numRows * numCols;
    if (numPieces > minNumPieces) {
      break;
    }
  }
  let squareSize = app.screen.height / numRows;
  if (squareSize * numCols > app.screen.width) {
    squareSize = Math.floor(app.screen.width / numCols);
  }
  squareSize *= 0.85; // shrink pieces a little to leave empty workspace
  console.log(`${firstBaseTexture.width}x${firstBaseTexture.height}`, squareRawSize, '-', `${app.screen.width}x${app.screen.height}`, squareSize);

  const getCorrectPosition = _.memoize(function(squareID) {
    const [row, col] = getRowAndCol(squareID);
    return {
      x: col * squareSize,
      y: row * squareSize,
    };
  });

  const squares = {}; window._d.squares = squares;
  for (let colIdx = 0; (colIdx+1)*squareRawSize < firstBaseTexture.width; colIdx++) {
    for (let rowIdx = 0; (rowIdx+1)*squareRawSize < firstBaseTexture.height; rowIdx++) {
      const squareID = getSquareID(rowIdx, colIdx);

      const textures = baseTextures.map(baseTexture => new PIXI.Texture(
        baseTexture,
        new PIXI.Rectangle(colIdx*squareRawSize, rowIdx*squareRawSize, squareRawSize, squareRawSize)
      ));
      textures.push(...textures.slice().reverse());

      const square = new PIXI.AnimatedSprite(textures);
      square.squareID = squareID;
      // square.x = (colIdx+.55) * squareSize * 1.05;
      // square.y = (rowIdx+.55) * squareSize * 1.05;
      square.width = square.height = squareSize;
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
  }
  _.shuffle(Object.keys(squares)).forEach((squareID,idx) => {
    const square = squares[squareID];
    const numOfCols = Math.floor(app.screen.width / squareSize - 0.05);
    const col = idx % numOfCols;
    const row = Math.floor(idx/numOfCols);
    square.x = (0.5 * squareSize) + (col * squareSize);
    square.y = (0.5 * squareSize) + (row * squareSize);
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
    // Show this square above all other squares.  This requires 'this.parent.sortableChildren'.
    square.zIndex = 1 + _.max(Object.values(squares).map(sq => sq.zIndex));
  }
  function onDragMove(event) {
    const square = this;
    if (square.isDragging) {
      const pointerPosition = event.data.getLocalPosition(square.parent);
      var squarePosition = {
        x: pointerPosition.x - this.dragStartOffset.x,
        y: pointerPosition.y - this.dragStartOffset.y
      };
      squarePosition.x = _.clamp(squarePosition.x, 0, app.screen.width); //keep visible on screen
      squarePosition.y = _.clamp(squarePosition.y, 0, app.screen.height);
      squarePosition.x = (Math.floor(squarePosition.x / squareSize) + 0.5) * squareSize;
      squarePosition.y = (Math.floor(squarePosition.y / squareSize) + 0.5) * squareSize;
      square.x = squarePosition.x;
      square.y = squarePosition.y;
    }
  }
  function onDragEnd() {
    const square = this;
    square.isDragging = false;
    square.dragStartOffset = undefined;
  }

});
