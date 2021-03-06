const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

let lastZoomMousePos;
let g, outerG;
let currentScale = 1;

function scaleMap(velocity, e) {
  if (g && (currentScale > 0.5 || velocity > 0) && (currentScale < 5 || velocity < 0)) {
    const newScale = currentScale + velocity / 100;
    currentScale = Math.min(Math.max(newScale, 0.5), 3);
    g.style.transform = `scale(${currentScale})`;

    let newOrigin;
    if (lastZoomMousePos) {
      newOrigin = { ...lastZoomMousePos };
      moveVel = Math.abs(velocity);
      if (newOrigin.x > e.clientX) {
        newOrigin.x = Math.max(newOrigin.x-moveVel, e.clientX);
      } else if (newOrigin.x < e.clientX) {
        newOrigin.x = Math.min(newOrigin.x+moveVel, e.clientX);
      }

      if (newOrigin.y > e.clientY) {
        newOrigin.y = Math.max(newOrigin.y-moveVel, e.clientY);
      } else if (newOrigin.y < e.clientY) {
        newOrigin.y = Math.min(newOrigin.y+moveVel, e.clientY);
      }
    } else {
      newOrigin = {
        x: e.clientX,
        y: e.clientY,
      };
    }
    g.style.transformOrigin = `${newOrigin.x}px ${newOrigin.y}px`;
    lastZoomMousePos = newOrigin;
  }
  e.preventDefault();
}

// modern Chrome requires { passive: false } when adding event
let supportsPassive = false;
try {
  window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
    get: function () { supportsPassive = true; }
  }));
} catch(e) {}

const wheelOpt = supportsPassive ? { passive: false } : false;
const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

window.addEventListener('DOMMouseScroll', (e) => scaleMap(e.deltaY, e), false); // older FF
window.addEventListener(wheelEvent, (e) => {
  const v = e.ctrlKey ? -2 * e.deltaY : -e.deltaY;
  scaleMap(v, e);
}, wheelOpt); // modern desktop

let dragging = false;
window.addEventListener('mousedown', (e) => {
  dragging = true;
  oldTouchClick = {
    x: e.clientX,
    y: e.clientY,
  };
  e.preventDefault();
}, false);
window.addEventListener('mouseup', (e) => {
  dragging = false;
  oldTouchClick = undefined;
  e.preventDefault();
}, false);
window.addEventListener('mousemove', (e) => {
  if (!dragging) {
    return;
  }
  pan(e);
  e.preventDefault;
}, false);

function pan(touchClick) {
  const newTouch = {
    x: touchClick.clientX,
    y: touchClick.clientY,
  };
  const diff = {
    x: oldTouchClick.x - newTouch.x,
    y: oldTouchClick.y - newTouch.y,
  };

  translateOffset.x -= diff.x;
  translateOffset.y -= diff.y;

  outerG.style.transform = `translate(${translateOffset.x}px, ${translateOffset.y}px)`;
  oldTouchClick = newTouch;
}
let oldTouchClick;
let translateOffset = {
  x: 0,
  y: 0,
}
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) { // it's a zoom
    handlePinchZoom(e);
    e.preventDefault();
    return;
  }
  oldPinch = undefined;
  if (!oldTouchClick) {
    oldTouchClick = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    return;
  }
  pan(e.changedTouches[0]);
  e.preventDefault();
}, wheelOpt); // mobile

let oldPinchDistance;
function measureDistance(e) {
  const diff = {
    x: Math.abs(e.touches[0].clientX - e.touches[1].clientX),
    y: Math.abs(e.touches[0].clientY - e.touches[1].clientY),
  };
  return Math.sqrt(diff.x ** 2 + diff.y ** 2)
}
function handlePinchZoom(e) {
  if (oldTouchClick) {
    oldTouchClick = undefined;
  }
  if (!oldPinchDistance) {
    oldPinchDistance = measureDistance(e);
    return;
  }
  const newDistance = measureDistance(e);
  scaleMap(newDistance-oldPinchDistance, {
    clientX: (e.touches[0].clientX + e.touches[1].clientX)/2,
    clientY: (e.touches[0].clientY + e.touches[1].clientY)/2,
    preventDefault: () => undefined,
  });
  oldPinchDistance = newDistance;
}
window.addEventListener('touchend', () => {
  oldTouchClick = undefined;
  oldPinchDistance = undefined;
}, wheelOpt);

document.addEventListener('DOMContentLoaded', function() {
  main();
});

let alreadyDrawnStations = {};

let lineToColor = {};

let title;
const opposites = {
  n: "s",
  ne: "sw",
  e: "w",
  se: "nw",
  s: "n",
  sw: "ne",
  w: "e",
  nw: "se",
};
const colors = ["red", "green", "blue", "yellow"];

async function main() {
  let style = getComputedStyle(document.body);
  lineToColor['green'] = style.getPropertyValue('--green');
  lineToColor['red'] = style.getPropertyValue('--red');
  lineToColor['blue'] = style.getPropertyValue('--blue');
  lineToColor['yellow'] = style.getPropertyValue('--yellow');
  lineToColor['grey'] = style.getPropertyValue('--grey');

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('main');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  document.body.appendChild(svg);

  outerG = document.createElementNS(SVG_NAMESPACE, 'g');
  outerG.id = 'outer-g';
  svg.appendChild(outerG);

  g = document.createElementNS(SVG_NAMESPACE, 'g');
  g.id = 'map';
  outerG.appendChild(g);

  const titleBar = document.createElementNS(SVG_NAMESPACE, 'rect');
  titleBar.setAttribute('x', 0);
  titleBar.setAttribute('y', 0);
  titleBar.setAttribute('width', '100%');
  titleBar.setAttribute('height', 75);
  titleBar.setAttribute('fill','#333344');
  svg.appendChild(titleBar);

  const canvas = svg.getBoundingClientRect();
  const start = {
    x: canvas.width * 3/5,
    y: canvas.height / 2
  };
  let coords = Object.assign({}, start);

  title = document.createElementNS(SVG_NAMESPACE, 'text');
  title.setAttribute('x', canvas.width / 2);
  title.setAttribute('y', 50);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('fill','#FFFFFF');
  title.id = 'title';
  svg.appendChild(title);

  const response = await fetch('data/stations.json');
  const timeline = await response.json();

  for (let i = 0; i < timeline.length; i++) {
    const instant = timeline[i];
    title.textContent = 'Tunnelbanan ' + instant.date;
    if (typeof instant.startPos !== 'undefined') {
      coords = moveXStepsInDirection(instant.startPos.offset.lengths, instant.startPos.offset.dir, {
        x: alreadyDrawnStations[instant.startPos.id].stationDot.cx.baseVal.value,
        y: alreadyDrawnStations[instant.startPos.id].stationDot.cy.baseVal.value
      });
    }

    let prevStation = { id: '' };
    for (let j = 0; j < instant.stations.length; j++) {
      const station = instant.stations[j];

      if (typeof station.type !== 'undefined') {
        if (station.type === 'deleteConnection') {
          const thisConn = document.querySelector('.' + station.from + station.direction);
          thisConn.classList.add('noanim');
          await sleep(50);
          thisConn.classList.add('hidden');
        } else if (station.type === 'deleteStation') {
          Object.values(alreadyDrawnStations[station.id].stationDots).map(stationDot => stationDot.classList.remove('shown'));
          alreadyDrawnStations[station.id].stationText.classList.remove('shown');
        } else if (station.type === 'changeConnectionColor') {
          const thisConn = document.querySelector('.' + station.from + station.direction);
          const oldColor = colors.filter(color => color !== instant.line && thisConn.classList.contains(color))[0];
          thisConn.classList.remove(oldColor);
          thisConn.classList.add(instant.line);
          thisConn.setAttribute('stroke', lineToColor[instant.line]);
          thisConn.setAttribute('transform', '');
          if (instant.line === 'red') {
            thisConn.setAttribute('transform', 'translate(-5)');
          } else if (instant.line === 'blue') {
            thisConn.setAttribute('transform', 'translate(0 -5)');
            thisConn.parentNode.insertBefore(thisConn, thisConn.parentNode.firstChild);
          } else if (instant.line === 'yellow') {
            thisConn.setAttribute('transform', 'translate(5 -5)');
            thisConn.parentNode.insertBefore(thisConn, thisConn.parentNode.firstChild);
          } else if (instant.line === 'grey') {
            thisConn.setAttribute('transform', 'translate(0 5)');
            thisConn.parentNode.insertBefore(thisConn, thisConn.parentNode.firstChild);
          }
          await sleep(50);
        } else if (station.type === 'changeStationColor') {
          const thisStation = alreadyDrawnStations[station.id];
          if (Object.keys(thisStation.stationDots).length > 1) {
            continue;
          }
          const [oldColor, thisDot] = Object.entries(thisStation.stationDots)[0];
          thisDot.classList.remove(oldColor);
          thisDot.classList.add(instant.line);
          thisDot.setAttribute('fill', lineToColor[instant.line]);
          thisDot.setAttribute('transform', '');
          if (instant.line === 'red') {
            thisDot.setAttribute('transform', 'translate(-5)');
          } else if (instant.line === 'blue') {
            thisDot.setAttribute('transform', 'translate(0 -5)');
            thisDot.parentNode.insertBefore(thisDot, thisDot.parentNode.firstChild);
          } else if (instant.line === 'yellow') {
            thisDot.setAttribute('transform', 'translate(5 -5)');
            thisDot.parentNode.insertBefore(thisDot, thisDot.parentNode.firstChild);
          } else if (instant.line === 'grey') {
            thisDot.setAttribute('transform', 'translate(0 5)');
            thisDot.parentNode.insertBefore(thisDot, thisDot.parentNode.firstChild);
          }
          await sleep(50);
        }
        continue;
      }

      let stationText;

      if (typeof alreadyDrawnStations[station.id] === 'undefined') {
        stationText = newStationName(coords.x, coords.y, station.textAngle, station.textAnchor, station.name, instant.line);
        g.appendChild(stationText);
      } else {
        if  (typeof station.newName !== 'undefined') {
          alreadyDrawnStations[station.id].stationText.textContent = station.newName;
        }
        coords = {
          x: alreadyDrawnStations[station.id].stationDot.cx.baseVal.value,
          y: alreadyDrawnStations[station.id].stationDot.cy.baseVal.value
        };
      }

      let stationDot = newStation(coords.x, coords.y, instant.line, station.id);
      if (alreadyDrawnStations[station.id]) {
        if (!alreadyDrawnStations[station.id].stationDots[instant.line]) {
          alreadyDrawnStations[station.id].stationDots[instant.line] = stationDot;
          if (instant.line !== 'red') {
            g.insertBefore(stationDot, g.firstChild);
          } else {
            g.appendChild(stationDot);
          }
        }
      } else {
        if (instant.line !== 'red') {
          g.insertBefore(stationDot, g.firstChild);
        } else {
          g.appendChild(stationDot);
        }
      }

      const connectionDirections = Object.keys(station.connections);
      let connection;
      for (let k = 0; k < connectionDirections.length; k++) {
        let thisConnection = station.connections[connectionDirections[k]];
        if (thisConnection !== prevStation.id) {
          let steps = 1;
          if (typeof thisConnection !== 'string') {
            steps = thisConnection.distance;
          }
          const moved = moveXStepsInDirection(steps, connectionDirections[k], coords);
          connection = newConnection(coords.x, coords.y, moved.x, moved.y, instant.line);
          connection.classList.add(station.id+connectionDirections[k]);
          connection.direction = connectionDirections[k];
          coords = moved;
          break;
        }
      }
      if (alreadyDrawnStations[station.id] && connection) {
        alreadyDrawnStations[station.id].connectionSvgs[`${connection.direction}-${instant.line}`] = connection;
      }

      await sleep(5);
      stationDot.classList.add('shown');
      if (typeof alreadyDrawnStations[station.id] === 'undefined') {
        stationText.classList.add('shown');
      }

      if (typeof alreadyDrawnStations[station.id] === 'undefined') {
        alreadyDrawnStations[station.id] = {
          station: station,
          stationDot: stationDot,
          stationDots: {
            [instant.line]: stationDot
          },
          stationText: stationText,
          connectionSvgs: {},
          connections: connectionDirections.map(dir => {
            return {
              name: station.connections[dir]
            };
          })
        };
        if (connection) {
          alreadyDrawnStations[station.id].connectionSvgs[`${connection.direction}-${instant.line}`] = connection;
        }
      }

      prevStation = station;
      await sleep(500);
      if (typeof connection !== 'undefined') {
        if (instant.line !== 'red') {
          g.insertBefore(connection, g.firstChild);
        } else {
          g.appendChild(connection);
        }
      }
    }
  }
  console.log('done drawing');
}

function moveXStepsInDirection (x, direction, coords) {
  const STEP_SIZE = 30 * x;
  let modifiedCoords = Object.assign({}, coords);

  switch (direction) {
    case 's':
      modifiedCoords.y += STEP_SIZE;
      break;
    case 'sw':
      modifiedCoords.x -= STEP_SIZE;
      modifiedCoords.y += STEP_SIZE;
      break;
    case 'w':
      modifiedCoords.x -= STEP_SIZE;
      break;
    case 'nw':
      modifiedCoords.x -= STEP_SIZE;
      modifiedCoords.y -= STEP_SIZE;
      break;
    case 'n':
      modifiedCoords.y -= STEP_SIZE;
      break;
    case 'ne':
      modifiedCoords.x += STEP_SIZE;
      modifiedCoords.y -= STEP_SIZE;
      break;
    case 'e':
      modifiedCoords.x += STEP_SIZE;
      break;
    case 'se':
      modifiedCoords.x += STEP_SIZE;
      modifiedCoords.y += STEP_SIZE;
      break;
  }
  return modifiedCoords;
}

function newStation(x, y, line, stationId) {
  let station = document.createElementNS(SVG_NAMESPACE, 'circle');
  station.setAttribute('cx', x);
  station.setAttribute('cy', y);
  station.setAttribute('r', stationId.includes('elbow') ? 3 : 5);
  station.setAttribute('fill', lineToColor[line]);
  station.classList.add(line);

  if (line === 'red') {
    station.setAttribute('transform', 'translate(-5)');
  } else if (line === 'blue') {
    station.setAttribute('transform', 'translate(0 -5)');
  } else if (line === 'yellow') {
    station.setAttribute('transform', 'translate(5 -5)');
  } else if (line === 'grey') {
    station.setAttribute('transform', 'translate(0 5)');
  }

  return station;
}
function newStationName(x, y, angle, anchor, text, line) {
  let anglex;
  if (anchor === 'start') {
    x += 15;
    anglex = x - 15;
  } else if (anchor === 'end') {
    x -= 15;
    anglex = x + 15;
  }
  let name = document.createElementNS(SVG_NAMESPACE, 'text');
  name.setAttribute('x', x);
  name.setAttribute('y', y);
  name.setAttribute('fill', '#FFFFFF');
  name.setAttribute('text-anchor', anchor);
  name.setAttribute('dominant-baseline', 'central');
  name.textContent = text;
  name.classList.add(line);

  let transform = '';
  if (line === 'red') {
    transform += 'translate(-5) ';
  } else if (line === 'blue') {
    transform += 'translate(0 -5) ';
  } else if (line === 'yellow') {
    transform += 'translate(5 -5) ';
  } else if (line === 'grey') {
    transform += 'translate(0 5) ';
  }
  transform += `rotate(${angle}, ${anglex}, ${y})`;
  name.setAttribute('transform', transform);

  return name;
}
function newConnection(x1, y1, x2, y2, line) {
  let conn = document.createElementNS(SVG_NAMESPACE, 'line');
  conn.setAttribute('x1', x1);
  conn.setAttribute('y1', y1);
  conn.setAttribute('x2', x2);
  conn.setAttribute('y2', y2);
  conn.setAttribute('stroke', lineToColor[line]);
  conn.setAttribute('stroke-width', '3');
  conn.classList.add(line);

  if (line === 'red') {
    conn.setAttribute('transform', 'translate(-5)');
  } else if (line === 'blue') {
    conn.setAttribute('transform', 'translate(0 -5)');
  } else if (line === 'yellow') {
    conn.setAttribute('transform', 'translate(5 -5)');
  } else if (line === 'grey') {
    conn.setAttribute('transform', 'translate(0 5)');
  }

  return conn;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
