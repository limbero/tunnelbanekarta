const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

document.addEventListener('DOMContentLoaded', function() {
  main();
});

let alreadyDrawnStations = {};

let lineToColor = {};

let title;

async function main() {
  let style = getComputedStyle(document.body);
  lineToColor['green'] = style.getPropertyValue('--green');
  lineToColor['red'] = style.getPropertyValue('--red');
  lineToColor['blue'] = style.getPropertyValue('--blue');

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('main');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  document.body.appendChild(svg);

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
      coords = moveXStepsInDirection(3, 'n', {
        x: alreadyDrawnStations[instant.startPos.id].stationDot.cx.baseVal.value,
        y: alreadyDrawnStations[instant.startPos.id].stationDot.cy.baseVal.value
      });
    }

    let prevStation = { id: '' };
    for (let j = 0; j < instant.stations.length; j++) {
      const station = instant.stations[j];

      if (typeof station.type !== 'undefined' && station.type === 'deleteConnection') {
        const thisConn = document.querySelector('.' + station.from + station.direction);
        thisConn.classList.add('noanim');
        await sleep(50);
        thisConn.classList.add('hidden');
        continue;
      }

      let stationText;

      if (typeof alreadyDrawnStations[station.id] === 'undefined') {
        stationText = newStationName(coords.x, coords.y, station.textAngle, station.textAnchor, station.name, instant.line);
        svg.appendChild(stationText);
      } else {
        if  (typeof station.newName !== 'undefined') {
          alreadyDrawnStations[station.id].stationText.textContent = station.newName;
        }
        coords = {
          x: alreadyDrawnStations[station.id].stationDot.cx.baseVal.value,
          y: alreadyDrawnStations[station.id].stationDot.cy.baseVal.value
        };
      }

      let stationDot = newStation(coords.x, coords.y, instant.line);
      if (instant.line === 'blue') {
        svg.insertBefore(stationDot, svg.firstChild);
      } else {
        svg.appendChild(stationDot);
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
          coords = moved;
          break;
        }
      }

      await sleep(5);
      stationDot.classList.add('shown');
      if (typeof alreadyDrawnStations[station.id] === 'undefined') {
        stationText.classList.add('shown');
      }

      alreadyDrawnStations[station.id] = {
        station: station,
        stationDot: stationDot,
        stationText: stationText,
        connections: connectionDirections.map(dir => {
          return {
            name: station.connections[dir]
          };
        })
      };

      prevStation = station;
      await sleep(500);
      if (typeof connection !== 'undefined') {
        if (instant.line === 'blue') {
          svg.insertBefore(connection, svg.firstChild);
        } else {
          svg.appendChild(connection);
        }
      }
    }
  }
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

function newStation(x, y, line) {
  let station = document.createElementNS(SVG_NAMESPACE, 'circle');
  station.setAttribute('cx', x);
  station.setAttribute('cy', y);
  station.setAttribute('r', 5);
  station.setAttribute('fill', lineToColor[line]);
  station.classList.add(line);

  if (line === 'red') {
    station.setAttribute('transform', 'translate(-5)');
  } else if (line === 'blue') {
    station.setAttribute('transform', 'translate(5)');
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
    transform += 'translate(5) ';
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
    conn.setAttribute('transform', 'translate(5)');
  }

  return conn;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
