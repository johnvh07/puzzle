/* global PIXI, _ */

// Note: the image must be served via http* (not file://) due to CORS.
// Note: TODOs in README

window._d = window._d || {}; // for debugging in browser console

function findGetParameter(parameterName) {
  var result = null;
  var tmp = [];
  location.search
    .substr(1)
    .split("&")
    .forEach(function (item) {
      tmp = item.split("=");
      if (tmp[0] === parameterName) { result = decodeURIComponent(tmp[1]); }
    });
  return result;
}
function extent(arr) {
  let min, max;
  min = max = arr[0];
  for (let elem of arr) {
    if (elem < min) { min = elem; }
    if (elem > max) { max = elem; }
  }
  return [min, max];
}

const imageName = findGetParameter('image') || 'viv-slide'; console.log('Note: Try appending ?image=hex to URL');
const minNumPieces = +findGetParameter('pieces') || 100; console.log('Note: Try appending ?pieces=30 to URL');

if (localStorage.getItem('puzzleSaveIndex')==null){
  var puzzleSaveIndex = {};
  localStorage.setItem('puzzleSaveIndex', JSON.stringify(puzzleSaveIndex));
}

console.log(localStorage.getItem(minNumPieces + '_' + imageName));

fetch(`https://petervh.com/live/${imageName}/info.json`)
  .then(response => response.json())
  .then( function(data){ 
    const squareIDRowMultiplier = 10000; // Never do a puzzle with 10001 or more columns
    const getSquareID = function(row, column) {
      return row * squareIDRowMultiplier + column;
    };
    const getSourceRowCol = _.memoize(function(squareID) {
      return [
        Math.floor(squareID / squareIDRowMultiplier),
        squareID % squareIDRowMultiplier
      ];
    });
    var maxFileNum = data.max_filenum || 1;
    const app = new PIXI.Application({
      backgroundColor:0x444444,
      width:window.innerWidth - 3, height:window.innerHeight - 10,
    });
    window._d.app = app;
    app.stage.sortableChildren = true; // required for zIndex to have any effect
    document.body.appendChild(app.view);
    const imgPaths = _.range(1, 1+maxFileNum).map(i => `https://petervh.com/live/${imageName}/${i}.jpg`);

    imgPaths.forEach(imgPath => app.loader.add(imgPath));
    app.loader.load(function() {

      const baseTextures = imgPaths.map(imgPath => PIXI.BaseTexture.from(imgPath));
      const firstBaseTexture = baseTextures[0];
      // TODO: assert that all baseTextures have the same width and height

      // Define the grid:
      // `sourceSquareSize` is the width and height of the square extracted from the input image (which is stored in `baseTexture`)
      // `screenSquareSize` is the width and height of the square drawn into the <canvas> (which is accessed via `app.screen`)
      // Define sourceSquareSize by finding the number of rows needed to get at least minNumPieces.
      for(var sourceNumRows = 1;; sourceNumRows++) {
        var sourceSquareSize = Math.floor(firstBaseTexture.height / sourceNumRows);
        var sourceNumCols = Math.floor(firstBaseTexture.width / sourceSquareSize);
        const numPieces = sourceNumRows * sourceNumCols;
        if (numPieces >= minNumPieces) {
          break;
        }
      }
      // Set screenSquareSize to make the puzzle fit nicely on the screen
      const numOccupiedCells = sourceNumRows * sourceNumCols;
      let screenSquareSize = Math.min(
        app.screen.height / sourceNumRows,  // size to fit height
        app.screen.width / sourceNumCols,  // size to fit width
        Math.sqrt(app.screen.height * app.screen.width / numOccupiedCells * 0.5),  // size to use only 50% of the screen
      );
      // Iteratively shrink screenSquareSize until 50% (or less) of cells are occupied
      while (1) {
        const totalNumCells = Math.floor(app.screen.width / screenSquareSize) * Math.floor(app.screen.height / screenSquareSize);
        if (numOccupiedCells / totalNumCells < 0.5) {
          break;
        }
        screenSquareSize *= 0.99;
      }
      // Grow screenSquareSize a bit so that some row or column will perfectly hit the edge of the screen
      const screenNumCols = Math.floor(app.screen.width / screenSquareSize);
      const screenNumRows = Math.floor(app.screen.height / screenSquareSize);
      screenSquareSize = Math.min(
        app.screen.width / screenNumCols,
        app.screen.height / screenNumRows
      );
      console.log(`${firstBaseTexture.width}x${firstBaseTexture.height}`, sourceSquareSize, '-', `${app.screen.width}x${app.screen.height}`, screenSquareSize);

      const sourceRowColPairs = Array.from(function* () {
        for (let colIdx = 0; colIdx < sourceNumCols; colIdx++) {
          for (let rowIdx = 0; rowIdx < sourceNumRows; rowIdx++) {
            yield [rowIdx, colIdx];
          }
        }
      }());
      const screenRowColPairs = Array.from(function* () {
        for (let colIdx = 0; (colIdx+1)*screenSquareSize <= app.screen.width; colIdx++) {
          for (let rowIdx = 0; (rowIdx+1)*screenSquareSize <= app.screen.height; rowIdx++) {
            yield [rowIdx, colIdx];
          }
        }
      }());
      function getScreenXYFromRowCol(row, col) {
        return [0.5 * screenSquareSize + col * screenSquareSize, 0.5 * screenSquareSize + row * screenSquareSize];
      }
      const screenXYPairs = screenRowColPairs.map(([row,col]) => getScreenXYFromRowCol(row, col));
      function getScreenRowColFromXY(x, y) {
        x = _.clamp(x, 0, screenNumCols * screenSquareSize - 0.01);
        y = _.clamp(y, 0, screenNumRows * screenSquareSize - 0.01);
        return [Math.floor(y / screenSquareSize), Math.floor(x / screenSquareSize)];
      }

      const getNeighborIDs = _.memoize(function(squareID) {
        // Given a squareID like `30004` (ie, row=3, column=4),
        // return the IDs of the squares above, below, and beside the square,
        // which are [20004, 30003, 30005, 40004].
        squareID = +squareID;
        const [row, col] = getSourceRowCol(squareID);
        const ret = [];
        if (row > 0) { ret.push(getSquareID(row-1, col)); }
        if (col > 0) { ret.push(getSquareID(row, col-1)); }
        if (row+1 < sourceNumRows) { ret.push(getSquareID(row+1, col)); }
        if (col+1 < sourceNumCols) { ret.push(getSquareID(row, col+1)); }
        return ret;
      });

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
          x: pointerPosition.x - square.position.x,
          y: pointerPosition.y - square.position.y,
        };
        square.isDragging = true;

        // Bring along aligned neighbors
        square.aligned = {squares: []};
        function addAlignedSquare(alignedSquareID) {
          if (!square.aligned.squares.includes(alignedSquareID)) {
            square.aligned.squares.push(alignedSquareID);
            const alignedSquare = squares[alignedSquareID];
            const alignedSourceRowCol = getSourceRowCol(alignedSquareID);
            const alignedScreenRowCol = getScreenRowColFromXY(alignedSquare.x, alignedSquare.y);
            getNeighborIDs(alignedSquareID).forEach(neighborID => {
              if (!squares[neighborID]) {
                console.error(`Tried to get fake squareID ${neighborID}`);
              }
              const neighborSquare = squares[neighborID];
              const neighborSourceRowCol = getSourceRowCol(neighborID);
              const neighborScreenRowCol = getScreenRowColFromXY(neighborSquare.x, neighborSquare.y);
              const isAligned = (
                (neighborSourceRowCol[0] - alignedSourceRowCol[0] === neighborScreenRowCol[0] - alignedScreenRowCol[0]) &&
                (neighborSourceRowCol[1] - alignedSourceRowCol[1] === neighborScreenRowCol[1] - alignedScreenRowCol[1])
              );
              if (isAligned) { addAlignedSquare(neighborID); }
            });
          }
        }
        addAlignedSquare(square.squareID);

        // Calculate colOffsetExtent and rowOffsetExtent to prevent dragging a group off the screen edge
        const mySourceRowCol = getSourceRowCol(square.squareID);
        square.aligned.colOffsetExtent = extent(square.aligned.squares.map(sqID => getSourceRowCol(sqID)[1] - mySourceRowCol[1]));
        square.aligned.rowOffsetExtent = extent(square.aligned.squares.map(sqID => getSourceRowCol(sqID)[0] - mySourceRowCol[0]));

        // Show held squares above non-held squares.  This requires 'this.parent.sortableChildren'.
        square.aligned.squares.forEach(sqID => { squares[sqID].zIndex = 1; });

        // console.log(mySourceRowCol, square.aligned);
      }
      function onDragMove(event) {
        const square = this;
        if (square.isDragging && square.aligned && square.aligned.squares.length) {
          const pointerPosition = event.data.getLocalPosition(square.parent);
          let squareXY = [
            pointerPosition.x - square.dragStartOffset.x,
            pointerPosition.y - square.dragStartOffset.y
          ];

          // If any squares in the group are off the screen, move myScreenRowCol until they're back in.
          let myScreenRowCol = getScreenRowColFromXY(...squareXY);
          const smallestCol = myScreenRowCol[1] + square.aligned.colOffsetExtent[0];
          if (smallestCol < 0) { myScreenRowCol[1] += -smallestCol; }
          const smallestRow = myScreenRowCol[0] + square.aligned.rowOffsetExtent[0];
          if (smallestRow < 0 ) { myScreenRowCol[0] += -smallestRow; }
          const biggestCol = myScreenRowCol[1] + square.aligned.colOffsetExtent[1];
          if (biggestCol >= screenNumCols ) { myScreenRowCol[1] += screenNumCols - biggestCol - 1; }
          const biggestRow = myScreenRowCol[0] + square.aligned.rowOffsetExtent[1];
          if (biggestRow >= screenNumRows ) { myScreenRowCol[0] += screenNumRows - biggestRow - 1; }

          squareXY = getScreenXYFromRowCol(...myScreenRowCol); // Use new rowCol and also align to grid

          const mySourceRowCol = getSourceRowCol(square.squareID);
          square.aligned.squares.forEach(sqID => {
            const sq = squares[sqID];
            const sqSourceRowCol = getSourceRowCol(sqID);
            sq.x = squareXY[0] + screenSquareSize * (sqSourceRowCol[1] - mySourceRowCol[1]);
            sq.y = squareXY[1] + screenSquareSize * (sqSourceRowCol[0] - mySourceRowCol[0]);
          });
        }
      }

      // Save the Puzzle to local storage.
      function savePuzzleProgress() {
        var puzzleSaveIndex = JSON.parse(localStorage.getItem('puzzleSaveIndex'));
        puzzleSaveIndex[ minNumPieces + '_' + imageName ] = {
          size: minNumPieces,
          image: imageName,
          progress: Math.floor(Math.random() * 100), //<----------------------------------------------update later with actual progress data **********************************************************
          timeSaved: Math.floor(new Date().getTime() / 1000)
        }
        localStorage.setItem('puzzleSaveIndex', JSON.stringify(puzzleSaveIndex));

        var pieceLocations = {};
        Object.keys(squares).forEach(squareID => {
          pieceLocations[squareID] = getSquareID(...getScreenRowColFromXY(squares[squareID].x, squares[squareID].y));
        });
        localStorage.setItem(minNumPieces + '_' + imageName, JSON.stringify(pieceLocations));
      }

      function onDragEnd() {
        const square = this;
        if (square.isDragging && square.aligned) {
          square.isDragging = false;
          square.dragStartOffset = undefined;

          // Shove the squares getting covered-up into empty spaces
          // TODO: instead of re-using getSquareID, make an equivalent function with a better name
          const groundOccupiedPositions = _.filter(squares, sq => sq.zIndex === 0).map(sq => getSquareID(...getScreenRowColFromXY(sq.x, sq.y)));
          const airOccupiedPositions = _.filter(squares, sq => sq.zIndex === 1).map(sq => getSquareID(...getScreenRowColFromXY(sq.x, sq.y)));
          const clobberedPositions = _.intersection(groundOccupiedPositions, airOccupiedPositions);
          const occupiedPositions = _.union(groundOccupiedPositions, airOccupiedPositions);
          const allPositions = screenRowColPairs.map(([row, col]) => getSquareID(row, col));
          const emptyPositions = _.difference(allPositions, occupiedPositions);
          const clobberedSquares = _.filter(squares, sq => {
            if (sq.zIndex !== 0) { return false; }
            const screenRowCol = getScreenRowColFromXY(sq.x, sq.y);
            const positionID = getSquareID(...screenRowCol);
            return clobberedPositions.includes(positionID);
          });
          // console.log('groundOccupiedPositions =', _.sortBy(groundOccupiedPositions));
          // console.log('airOccupiedPositions =', _.sortBy(airOccupiedPositions));
          // console.log('clobberedPositions =', _.sortBy(clobberedPositions));
          // console.log('clobberedSquares =', clobberedSquares);
          // console.log('occupiedPositions =', _.sortBy(occupiedPositions));
          // console.log('allPositions =', _.sortBy(allPositions));
          // console.log('emptyPositions =', _.sortBy(emptyPositions));
          _.shuffle(clobberedSquares).forEach(sq => {
            const newPosition = emptyPositions.pop();
            const newXY = getScreenXYFromRowCol(...getSourceRowCol(newPosition));
            // console.log(`moving clobbered sq from ${sq.x},${sq.y} -> ${newXY[0]},${newXY[1]}`);
            [sq.x, sq.y] = newXY;
          });

          square.aligned.squares.forEach(sqID => { squares[sqID].zIndex = 0; });
          delete square.aligned;

          savePuzzleProgress();
        }
      }
    });
  }
);
