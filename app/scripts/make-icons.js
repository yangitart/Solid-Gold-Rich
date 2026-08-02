/* global require, module, __dirname */
// Genera los iconos de la app. No hay editor gráfico de por medio: el diamante
// se rasteriza pixel a pixel con pngjs (la única librería de imagen que ya está
// en el árbol), así que el icono se puede regenerar en cualquier momento con
// `node scripts/make-icons.js` y siempre sale idéntico.
//
// El corte es un brillante visto de perfil: corona (tres facetas entre la mesa y
// el filetín) y pabellón (tres facetas hasta el culet). Cada faceta lleva su
// propio degradado y su propia dirección de luz — eso es lo que da la sensación
// de talla, no el contorno.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT = path.join(__dirname, '..', 'assets', 'images');

// --- Geometría del brillante, en coordenadas normalizadas (y hacia abajo) ---
const TABLE_Y = -0.42; // mesa (arriba)
const GIRDLE_Y = -0.2; // filetín (la parte más ancha)
const CULET_Y = 0.82; // punta inferior
const HALF_W = 0.72;
const TABLE_HALF = 0.3;
const SPLIT = 0.24; // donde se dividen las facetas sobre el filetín

// [poligono, colorA, colorB, dirección del degradado]
const FACETS = [
  // Corona
  [
    [[-HALF_W, GIRDLE_Y], [-SPLIT, GIRDLE_Y], [-TABLE_HALF, TABLE_Y]],
    [255, 244, 214], [201, 162, 77], [0.6, 1],
  ],
  [
    [[-SPLIT, GIRDLE_Y], [SPLIT, GIRDLE_Y], [TABLE_HALF, TABLE_Y], [-TABLE_HALF, TABLE_Y]],
    [255, 250, 231], [225, 190, 112], [0.2, 1],
  ],
  [
    [[SPLIT, GIRDLE_Y], [HALF_W, GIRDLE_Y], [TABLE_HALF, TABLE_Y]],
    [222, 186, 110], [150, 114, 42], [-0.7, 1],
  ],
  // Pabellón
  [
    [[-HALF_W, GIRDLE_Y], [-SPLIT, GIRDLE_Y], [0, CULET_Y]],
    [214, 176, 100], [95, 71, 25], [0.5, 1],
  ],
  [
    [[-SPLIT, GIRDLE_Y], [SPLIT, GIRDLE_Y], [0, CULET_Y]],
    [246, 224, 160], [122, 93, 33], [0, 1],
  ],
  [
    [[SPLIT, GIRDLE_Y], [HALF_W, GIRDLE_Y], [0, CULET_Y]],
    [150, 116, 45], [52, 39, 13], [-0.5, 1],
  ],
];

// Aristas que se repasan con luz. El filetín va aparte y más grueso: en una
// piedra real es la banda pulida que más brilla.
const EDGES = [
  [[-HALF_W, GIRDLE_Y], [-TABLE_HALF, TABLE_Y]],
  [[HALF_W, GIRDLE_Y], [TABLE_HALF, TABLE_Y]],
  [[-TABLE_HALF, TABLE_Y], [TABLE_HALF, TABLE_Y]],
  [[-SPLIT, GIRDLE_Y], [-TABLE_HALF, TABLE_Y]],
  [[SPLIT, GIRDLE_Y], [TABLE_HALF, TABLE_Y]],
  [[-HALF_W, GIRDLE_Y], [0, CULET_Y]],
  [[HALF_W, GIRDLE_Y], [0, CULET_Y]],
  [[-SPLIT, GIRDLE_Y], [0, CULET_Y]],
  [[SPLIT, GIRDLE_Y], [0, CULET_Y]],
];
const GIRDLE = [[-HALF_W, GIRDLE_Y], [HALF_W, GIRDLE_Y]];

const BG = [4, 5, 10];
const CENTER_Y = (TABLE_Y + CULET_Y) / 2; // para centrar la piedra en el lienzo

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distToSeg(x, y, [[ax, ay], [bx, by]]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(x - px, y - py);
}

// Color de UNA muestra (gx,gy en espacio de la gema; gr = radio para el halo).
function sample(gx, gy, gr, transparent) {
  // Halo: brillo dorado que se apaga hacia fuera. Es lo que hace que el icono no
  // se vea como un sticker pegado sobre negro.
  // Un halo demasiado ancho vuelve el negro marrón y el icono pierde el
  // contraste que lo hace legible a 48 px: corto y algo saturado.
  const glow = Math.exp(-Math.pow(gr / 0.62, 2)) * 0.42;
  let r = BG[0] + 233 * glow;
  let g = BG[1] + 200 * glow;
  let b = BG[2] + 119 * glow;
  let a = transparent ? Math.min(1, glow * 2.2) : 1;

  for (const [poly, c0, c1, dir] of FACETS) {
    if (!inside(poly, gx, gy)) continue;
    // Posición dentro de la faceta a lo largo de su dirección de luz, llevada a
    // 0..1 con el rango total de la piedra — no hace falta más precisión.
    const t = Math.min(1, Math.max(0, (gx * dir[0] + gy * dir[1] + 0.75) / 1.6));
    r = c0[0] + (c1[0] - c0[0]) * t;
    g = c0[1] + (c1[1] - c0[1]) * t;
    b = c0[2] + (c1[2] - c0[2]) * t;
    a = 1;
    break;
  }

  // Aristas iluminadas
  let edge = 0;
  for (const e of EDGES) edge = Math.max(edge, 1 - distToSeg(gx, gy, e) / 0.012);
  const girdle = 1 - distToSeg(gx, gy, GIRDLE) / 0.022;
  edge = Math.max(edge, girdle);
  if (edge > 0) {
    const k = Math.min(1, edge) * 0.85;
    r += (255 - r) * k;
    g += (246 - g) * k;
    b += (214 - b) * k;
    a = Math.max(a, k);
  }

  return [r, g, b, a * 255];
}

function render(size, gemScale, { transparent = false } = {}) {
  const png = new PNG({ width: size, height: size });
  const k = gemScale / HALF_W; // cuánto ocupa la piedra respecto al lienzo
  const SS = 2; // supermuestreo 2x2: sin esto las aristas salen dentadas

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const v = ((py + (sy + 0.5) / SS) / size) * 2 - 1;
          const gx = u / k;
          const gy = v / k + CENTER_Y;
          const [sr, sg, sb, sa] = sample(gx, gy, Math.hypot(u, v) / k, transparent);
          r += sr; g += sg; b += sb; a += sa;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) << 2;
      png.data[i] = Math.round(Math.min(255, r / n));
      png.data[i + 1] = Math.round(Math.min(255, g / n));
      png.data[i + 2] = Math.round(Math.min(255, b / n));
      png.data[i + 3] = Math.round(Math.min(255, a / n));
    }
  }
  return png;
}

function write(name, png) {
  const file = path.join(OUT, name);
  png.pack().pipe(fs.createWriteStream(file)).on('finish', () => console.log('✓', name));
}

// icon: la piedra generosa, casi tocando el borde.
write('icon.png', render(1024, 0.62));
// adaptive-icon: Android recorta a círculo/squircle — la piedra se queda dentro
// de la zona segura (66% central) o le rebana el culet.
write('adaptive-icon.png', render(1024, 0.40));
write('favicon.png', render(64, 0.68));
