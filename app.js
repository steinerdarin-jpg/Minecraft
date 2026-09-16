const canvas = document.getElementById('worldCanvas');
const COLS = 32;
const ROWS = 24;
const WORLD_DEPTH = 14;
const materials = [
  { name: 'Moosgras', detail: 'Natürlich · Stapel 64', base: '#759b4c', accent: '#a9c665', dark: '#4d713a' },
  { name: 'Lehm', detail: 'Erde · Stapel 64', base: '#a56845', accent: '#c5875b', dark: '#704333' },
  { name: 'Sand', detail: 'Natürlich · Stapel 64', base: '#d8bb77', accent: '#edd49a', dark: '#b19158' },
  { name: 'Stein', detail: 'Mineral · Stapel 64', base: '#7f8b88', accent: '#aab1a8', dark: '#596662' },
  { name: 'Holz', detail: 'Baumaterial · Stapel 32', base: '#996642', accent: '#c08a5c', dark: '#6e432f' },
  { name: 'Kohle', detail: 'Erz · Stapel 16', base: '#3d4845', accent: '#68716b', dark: '#242d2a' }
];
let selected = 0;
let world = [];
const keys = new Set();
const player = { x: 8.5, y: 12, z: 5, vy: 0, grounded: false };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9ac8d5');
scene.fog = new THREE.Fog('#9ac8d5', 28, 58);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 100);
camera.position.set(22, 20, 25);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 16;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(16, 5, 7);
scene.add(new THREE.HemisphereLight('#d9f4ed', '#52624f', 2.2));
const sun = new THREE.DirectionalLight('#fff3c4', 3.2);
sun.position.set(-10, 26, 12);
sun.castShadow = true;
scene.add(sun);
const voxelGroup = new THREE.Group();
scene.add(voxelGroup);
const blockMeshes = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const noise = (x, y, salt = 0) => Math.abs(Math.sin(x * 12.9898 + y * 78.233 + salt * 37.11) * 43758.5453) % 1;

function createWorld() {
  world = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    const shoreline = 14 + Math.round(Math.sin(x / 4) * 1.8 + Math.sin(x / 8) * 2);
    if (y < shoreline) return -1;
    if (y === shoreline) return 0;
    if (y < shoreline + 3) return 1;
    return noise(x, y) > .82 ? 3 : 1;
  }));
}

function resizeCanvas() {
  const box = canvas.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(box.width, box.height, false);
  camera.aspect = box.width / box.height;
  camera.updateProjectionMatrix();
}

function materialFor(type) {
  return new THREE.MeshStandardMaterial({ color: materials[type].base, roughness: .92, flatShading: true });
}

function addBlock(x, y, z, type) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialFor(type));
  mesh.position.set(x + .5, ROWS - y - .5, z + .5);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z };
  voxelGroup.add(mesh);
  blockMeshes.set(`${x}:${y}:${z}`, mesh);
}

function drawPlayer() {
  const body = new THREE.Group();
  body.position.set(player.x, ROWS - player.y - 1.1, player.z + .5);
  const skin = new THREE.MeshStandardMaterial({ color: '#f2c09a' });
  const shirt = new THREE.MeshStandardMaterial({ color: '#d25c4f' });
  const pants = new THREE.MeshStandardMaterial({ color: '#405f4a' });
  const head = new THREE.Mesh(new THREE.BoxGeometry(.55, .55, .55), skin);
  head.position.y = .95;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.65, .7, .4), shirt);
  torso.position.y = .4;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.62, .5, .4), pants);
  legs.position.y = -.2;
  body.add(head, torso, legs);
  body.traverse(part => { part.castShadow = true; });
  body.userData.player = true;
  scene.add(body);
}

function drawWorld() {
  voxelGroup.clear();
  blockMeshes.clear();
  world.forEach((row, y) => row.forEach((type, x) => {
    if (type >= 0) for (let z = 0; z < WORLD_DEPTH; z++) addBlock(x, y, z, type);
  }));
}

function groundAt(x) {
  const column = Math.max(0, Math.min(COLS - 1, Math.floor(x)));
  return world.findIndex(row => row[column] >= 0);
}

function updatePlayer() {
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const jump = keys.has(' ') || keys.has('w') || keys.has('arrowup');
  if (left) player.x -= .08;
  if (right) player.x += .08;
  player.x = Math.max(.2, Math.min(COLS - 1.2, player.x));
  if (jump && player.grounded) { player.vy = .25; player.grounded = false; }
  player.vy -= .012;
  player.y -= player.vy;
  const ground = groundAt(player.x);
  if (ground >= 0 && player.y >= ground) { player.y = ground; player.vy = 0; player.grounded = true; }
  if (ground < 0) { player.y = Math.min(ROWS - 2, player.y); player.grounded = false; }
  scene.children.filter(child => child.userData.player).forEach(child => scene.remove(child));
  drawPlayer();
  document.getElementById('coordinates').textContent = `X ${String(Math.floor(player.x)).padStart(2, '0')} · Y ${String(Math.floor(player.y)).padStart(2, '0')} · Z ${String(Math.floor(player.z)).padStart(2, '0')}`;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(updatePlayer);
}

function pixelPreview(material, size = 40) {
  const el = document.createElement('canvas');
  el.width = size; el.height = size;
  const c = el.getContext('2d');
  c.fillStyle = material.base; c.fillRect(0, 0, size, size);
  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
    c.fillStyle = noise(px, py, materials.indexOf(material)) > .72 ? material.accent : noise(px, py, 2) < .18 ? material.dark : material.base;
    c.fillRect(px * size / 8, py * size / 8, size / 8, size / 8);
  }
  return el.toDataURL();
}

function renderItems() {
  const inventory = document.getElementById('inventoryGrid');
  const hotbar = document.getElementById('hotbar');
  inventory.innerHTML = ''; hotbar.innerHTML = '';
  materials.forEach((material, index) => {
    const image = pixelPreview(material);
    const cell = document.createElement('button');
    cell.className = `inventory-cell${index === selected ? ' selected' : ''}`;
    cell.innerHTML = `<img class="pixel" src="${image}" alt="${material.name}"><span class="item-number">${index + 1}</span>`;
    cell.onclick = () => chooseMaterial(index); inventory.appendChild(cell);
    const slot = document.createElement('button');
    slot.className = `hotbar-slot${index === selected ? ' active' : ''}`;
    slot.innerHTML = `<span>${index + 1}</span><img class="pixel" src="${image}" alt="${material.name}">`;
    slot.onclick = () => chooseMaterial(index); hotbar.appendChild(slot);
  });
  updateSelected();
}

function chooseMaterial(index) { selected = index; renderItems(); }
function updateSelected() {
  const material = materials[selected];
  document.getElementById('selectedName').textContent = material.name;
  document.getElementById('selectedDetail').textContent = material.detail;
  document.getElementById('selectedPreview').style.backgroundImage = `url(${pixelPreview(material, 42)})`;
  document.getElementById('selectedPreview').style.backgroundSize = 'cover';
}

function interact(event, place) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(voxelGroup.children)[0];
  if (!hit) return;
  const block = hit.object.userData;
  if (place) {
    const z = block.z + 1;
    if (z < WORLD_DEPTH && !blockMeshes.has(`${block.x}:${block.y}:${z}`)) addBlock(block.x, block.y, z, selected);
  } else {
    world[block.y][block.x] = -1;
    voxelGroup.remove(...voxelGroup.children.filter(mesh => mesh.userData.x === block.x && mesh.userData.y === block.y));
  }
  document.getElementById('blockCount').textContent = `${world.flat().filter(value => value >= 0).length * WORLD_DEPTH} BLÖCKE`;
}

canvas.addEventListener('click', event => interact(event, false));
canvas.addEventListener('contextmenu', event => { event.preventDefault(); interact(event, true); });
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'a', 'd', 'w', 's'].includes(key)) { keys.add(key); event.preventDefault(); }
  const number = Number(event.key);
  if (number >= 1 && number <= materials.length) chooseMaterial(number - 1);
});
document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
document.getElementById('resetWorld').onclick = () => { createWorld(); player.x = 8.5; player.y = 12; player.vy = 0; drawWorld(); };
createWorld();
renderItems();
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawWorld();
updatePlayer();