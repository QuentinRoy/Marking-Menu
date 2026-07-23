/**
 Create a stroke canvas.

 @param {object} options - Configuration options.
 @param {HTMLElement} options.parent - The parent node.
 @param {Document} [options.doc=document] - The root document. Mostly useful for testing purposes.
 @param {number} [options.lineWidth=2] - The width of the stroke, in pixels.
 @param {string} [options.lineColor='black'] - CSS representation of the stroke color.
 @param {number} [options.pointRadius=0] - The radius of the point drawn at the start of the
 stroke.
 @param {string} [options.pointColor=options.lineColor] - CSS representation of the start point
 color.
 @param {number} [options.ptSize=1 / devicePixelRatio] - The size of the canvas points
 (px).
 @returns {{ clear, drawStroke, drawPoint, remove }} The canvas methods.
 */
export default function createStrokeCanvas({
  parent,
  doc = document,
  lineWidth = 2,
  lineColor = 'black',
  pointRadius = 0,
  pointColor = lineColor,
  ptSize = window.devicePixelRatio ? 1 / window.devicePixelRatio : 1,
}) {
  // Create the canvas.
  const { width, height } = parent.getBoundingClientRect();
  const canvas = doc.createElement('canvas');
  canvas.width = width / ptSize;
  canvas.height = height / ptSize;
  Object.assign(canvas.style, {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${width}px`,
    height: `${height}px`,
    'pointer-events': 'none',
  });
  parent.append(canvas);

  // Get the canvas' context and set it up
  const ctx = canvas.getContext('2d');
  // Scale to the device pixel ratio.
  ctx.scale(1 / ptSize, 1 / ptSize);

  /**
   Render the start-of-stroke marker at the given position.

   @param {number[]} point - Position of the point to draw.
   @returns {undefined}
   */
  const drawPoint = ([x, y]) => {
    ctx.save();
    ctx.strokeStyle = 'none';
    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.moveTo(x + pointRadius, y);
    ctx.arc(x, y, pointRadius, 0, 360);
    ctx.fill();
    ctx.restore();
  };

  /**
   Clear the canvas.
   
   @returns {undefined}
   */
  const clear = () => {
    ctx.clearRect(0, 0, width, height);
  };

  /**
   Render a path connecting every point of the given stroke.

   @param {List<number[]>} stroke - The new stroke.
   @returns {undefined}
   */
  const drawStroke = (stroke) => {
    ctx.save();
    ctx.fillStyle = 'none';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const [i, point] of stroke.entries()) {
      if (i === 0) {
        ctx.moveTo(...point);
      } else {
        ctx.lineTo(...point);
      }
    }

    ctx.stroke();
    ctx.restore();
  };

  /**
   Destroy the canvas.
   @returns {undefined}
   */
  const remove = () => {
    canvas.remove();
  };

  return { clear, drawStroke, drawPoint, remove };
}
