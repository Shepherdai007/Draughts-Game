/**
 * board3d.js - 3D Board Renderer using Three.js
 * Renders the draughts board in 3D with piece selection via raycasting
 */

class Board3D {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.board = null;         // current board state (2D array)
    this.pieceObjects = {};    // key: "row,col" -> THREE.Mesh
    this.squareObjects = [];   // selectable squares
    this.selectedPiece = null; // [row, col]
    this.highlightedSquares = [];
    this.animating = false;
    this.theme = THEMES.classic;
    this.onSquareClick = null; // callback(row, col)
    this._raycaster = null;
    this._mouse = null;
    this._clock = null;
    this._frameId = null;
    this._lights = [];
    this._boardGroup = null;
    this._pieceGroup = null;
    this._highlightGroup = null;
    this._materials = {};
    this._initialized = false;
    this._animations = [];
  }

  init() {
    const canvas = document.getElementById(this.canvasId);
    if (!canvas) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.bgColor);
    this.scene.fog = new THREE.FogExp2(this.theme.bgColor, 0.04);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45, canvas.clientWidth / canvas.clientHeight, 0.1, 200
    );
    this.camera.position.set(0, 14, 14);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Raycaster
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._clock = new THREE.Clock();

    // Lighting
    this._setupLights();

    // Groups
    this._boardGroup = new THREE.Group();
    this._pieceGroup = new THREE.Group();
    this._highlightGroup = new THREE.Group();
    this.scene.add(this._boardGroup, this._pieceGroup, this._highlightGroup);

    // Build board geometry
    this._buildBoard();

    // Events
    canvas.addEventListener('click', (e) => this._onClick(e));
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      this._handleClick(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });
    window.addEventListener('resize', () => this._onResize());

    this._initialized = true;
    this._startRenderLoop();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(8, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 10, -8);
    this.scene.add(fillLight);

    const rimLight = new THREE.PointLight(this.theme.rimColor || 0x4488ff, 0.6, 40);
    rimLight.position.set(-8, 6, -8);
    this.scene.add(rimLight);

    this._lights = [ambient, dirLight, fillLight, rimLight];
  }

  _buildBoard() {
    // Remove existing board objects
    while (this._boardGroup.children.length > 0) {
      this._boardGroup.remove(this._boardGroup.children[0]);
    }
    this.squareObjects = [];

    const t = this.theme;
    const squareSize = 1.8;
    const boardSize = 8 * squareSize;
    const offset = (boardSize - squareSize) / 2;

    // Board base (the frame/table)
    const baseGeo = new THREE.BoxGeometry(boardSize + 2, 0.7, boardSize + 2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: t.frameColor,
      roughness: 0.6,
      metalness: t.frameMetalness || 0.1,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.5;
    base.receiveShadow = true;
    this._boardGroup.add(base);

    // Board edge decoration (border ring)
    const ringGeo = new THREE.BoxGeometry(boardSize + 1.2, 0.35, boardSize + 1.2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: t.borderColor,
      roughness: 0.4,
      metalness: t.borderMetalness || 0.3,
      envMapIntensity: 1.0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.1;
    this._boardGroup.add(ring);

    // Build squares
    const squareGeo = new THREE.BoxGeometry(squareSize - 0.06, 0.28, squareSize - 0.06);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isDark = (row + col) % 2 === 1;
        const mat = new THREE.MeshStandardMaterial({
          color: isDark ? t.darkSquare : t.lightSquare,
          roughness: isDark ? 0.7 : 0.5,
          metalness: 0.05,
        });
        const square = new THREE.Mesh(squareGeo, mat);
        square.position.set(
          col * squareSize - offset,
          0,
          row * squareSize - offset
        );
        square.receiveShadow = true;
        square.userData = { row, col, type: 'square' };
        this._boardGroup.add(square);
        if (isDark) this.squareObjects.push(square);
      }
    }

    // Row/col label indicators (small dots at corners)
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    // Could add 3D text labels but keep simple for now

    this._squareSize = squareSize;
    this._offset = offset;
  }

  _getMaterial(key, options) {
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshStandardMaterial(options);
    }
    return this._materials[key];
  }

  _buildPiece(type) {
    const t = this.theme;
    const isPlayer = type === PLAYER || type === PLAYER_KING;
    const isKing = type === PLAYER_KING || type === COMPUTER_KING;

    const group = new THREE.Group();

    // Main disc
    const discGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.3, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color: isPlayer ? t.playerColor : t.computerColor,
      roughness: 0.3,
      metalness: 0.4,
      envMapIntensity: 1.0,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.castShadow = true;
    disc.receiveShadow = true;
    group.add(disc);

    // Top surface shine ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.06, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: isPlayer ? t.playerRing : t.computerRing,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    group.add(ring);

    if (isKing) {
      // Crown spires
      const crownMat = new THREE.MeshStandardMaterial({
        color: t.crownColor,
        roughness: 0.1,
        metalness: 0.9,
        emissive: new THREE.Color(t.crownColor).multiplyScalar(0.2),
      });
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spikeGeo = new THREE.ConeGeometry(0.1, 0.45, 8);
        const spike = new THREE.Mesh(spikeGeo, crownMat);
        spike.position.set(
          Math.cos(angle) * 0.42,
          0.52,
          Math.sin(angle) * 0.42
        );
        group.add(spike);
      }
      // Crown base band
      const bandGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 32, 1, true);
      const band = new THREE.Mesh(bandGeo, crownMat);
      band.position.y = 0.28;
      group.add(band);
      // Central jewel
      const gemGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const gemMat = new THREE.MeshStandardMaterial({
        color: isPlayer ? 0xff4444 : 0x4444ff,
        roughness: 0.0,
        metalness: 1.0,
        emissive: isPlayer ? 0x441100 : 0x001144,
        emissiveIntensity: 0.5,
      });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.y = 0.55;
      group.add(gem);
    }

    return group;
  }

  /** Update all pieces to match the given board state */
  updateBoard(boardState) {
    this.board = boardState;
    // Remove old pieces
    while (this._pieceGroup.children.length > 0) {
      this._pieceGroup.remove(this._pieceGroup.children[0]);
    }
    this.pieceObjects = {};

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = boardState[row][col];
        if (piece !== EMPTY) {
          this._addPiece(row, col, piece);
        }
      }
    }
  }

  _addPiece(row, col, type) {
    const group = this._buildPiece(type);
    const pos = this._getWorldPos(row, col);
    group.position.set(pos.x, 0.5, pos.z);
    group.userData = { row, col, type: 'piece', pieceType: type };
    this._pieceGroup.add(group);
    this.pieceObjects[`${row},${col}`] = group;
  }

  _getWorldPos(row, col) {
    const s = this._squareSize;
    const o = this._offset;
    return { x: col * s - o, z: row * s - o };
  }

  /**
   * Animate moving a piece from (fromRow, fromCol) to (toRow, toCol)
   * along the given path, removing captured pieces.
   */
  animateMove(from, to, path, captures, onComplete) {
    const key = `${from[0]},${from[1]}`;
    const pieceObj = this.pieceObjects[key];
    if (!pieceObj) { onComplete && onComplete(); return; }

    this.animating = true;
    const steps = path || [to];
    let stepIdx = 0;
    const speed = 8; // units/sec

    const moveTo = (target) => {
      const startPos = pieceObj.position.clone();
      const endPos = this._getWorldPos(target[0], target[1]);
      const dist = Math.sqrt((endPos.x - startPos.x) ** 2 + (endPos.z - startPos.z) ** 2);
      const duration = Math.max(0.18, dist / speed);
      let elapsed = 0;

      const animate = (dt) => {
        elapsed += dt;
        const t = Math.min(elapsed / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        pieceObj.position.x = startPos.x + (endPos.x - startPos.x) * ease;
        pieceObj.position.z = startPos.z + (endPos.z - startPos.z) * ease;
        // Arc up
        pieceObj.position.y = 0.5 + Math.sin(t * Math.PI) * 1.2;

        if (t >= 1) {
          pieceObj.position.y = 0.5;
          // Remove captured piece for this step (stepIdx-th capture, 0-indexed)
          if (stepIdx < captures.length) {
            const cap = captures[stepIdx];
            if (cap) this._removePiece(cap[0], cap[1]);
          }
          stepIdx++;
          if (stepIdx < steps.length) {
            moveTo(steps[stepIdx]);
          } else {
            // Final position
            const finalPos = this._getWorldPos(to[0], to[1]);
            pieceObj.position.set(finalPos.x, 0.5, finalPos.z);
            // Update key in pieceObjects
            delete this.pieceObjects[key];
            this.pieceObjects[`${to[0]},${to[1]}`] = pieceObj;
            pieceObj.userData.row = to[0];
            pieceObj.userData.col = to[1];
            this.animating = false;
            onComplete && onComplete();
          }
        }
        return t < 1;
      };

      this._addAnimation(animate);
    };

    moveTo(steps[0]);
  }

  _removePiece(row, col) {
    const key = `${row},${col}`;
    const obj = this.pieceObjects[key];
    if (obj) {
      this._animateCaptureEffect(obj.position.clone());
      this._pieceGroup.remove(obj);
      delete this.pieceObjects[key];
    }
  }

  _animateCaptureEffect(pos) {
    // Particle burst at capture position
    const particles = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.08, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: this.theme.captureColor || 0xff6600,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      const angle = (i / count) * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.12;
      p._vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.15 + Math.random() * 0.1,
        Math.sin(angle) * speed
      );
      this.scene.add(p);
      particles.push(p);
    }
    let t = 0;
    const animate = (dt) => {
      t += dt;
      for (const p of particles) {
        p.position.add(p._vel);
        p._vel.y -= 0.012;
        p.material.opacity = Math.max(0, 1 - t * 3);
        p.material.transparent = true;
        if (p.material.opacity <= 0) this.scene.remove(p);
      }
      return t < 0.5;
    };
    this._addAnimation(animate);
  }

  _addAnimation(fn) {
    this._animations.push(fn);
  }

  /** Promote a piece to king visually */
  promoteToKing(row, col, isPlayer) {
    const key = `${row},${col}`;
    if (this.pieceObjects[key]) {
      this._pieceGroup.remove(this.pieceObjects[key]);
    }
    const type = isPlayer ? PLAYER_KING : COMPUTER_KING;
    this._addPiece(row, col, type);
    // Flash effect
    const obj = this.pieceObjects[key];
    if (!obj) return;
    let t = 0;
    const animate = (dt) => {
      t += dt;
      const scale = 1 + 0.3 * Math.sin(t * 20);
      obj.scale.set(scale, scale, scale);
      return t < 0.6;
    };
    this._addAnimation(animate);
  }

  /** Highlight valid destination squares */
  showHighlights(squares, selectedPos) {
    this.clearHighlights();
    const t = this.theme;

    // Selected piece glow
    if (selectedPos) {
      const pos = this._getWorldPos(selectedPos[0], selectedPos[1]);
      const geo = new THREE.CylinderGeometry(0.78, 0.78, 0.08, 32);
      const mat = new THREE.MeshBasicMaterial({ color: t.selectedColor || 0x00ff88, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.32, pos.z);
      this._highlightGroup.add(mesh);
      this.highlightedSquares.push(mesh);
    }

    // Valid move indicators
    for (const [row, col] of squares) {
      const pos = this._getWorldPos(row, col);
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32);
      const mat = new THREE.MeshBasicMaterial({ color: t.highlightColor || 0x00ffff, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.32, pos.z);
      this._highlightGroup.add(mesh);
      this.highlightedSquares.push(mesh);

      // Pulsing ring
      const ringGeo = new THREE.RingGeometry(0.52, 0.68, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: t.highlightColor || 0x00ffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.34, pos.z);
      ring.userData.pulse = true;
      this._highlightGroup.add(ring);
      this.highlightedSquares.push(ring);
    }
  }

  clearHighlights() {
    while (this._highlightGroup.children.length > 0) {
      this._highlightGroup.remove(this._highlightGroup.children[0]);
    }
    this.highlightedSquares = [];
  }

  _startRenderLoop() {
    const animate = () => {
      this._frameId = requestAnimationFrame(animate);
      const dt = this._clock.getDelta();

      // Tick animations
      this._animations = this._animations.filter(fn => fn(dt));

      // Pulse highlights
      const time = this._clock.getElapsedTime();
      for (const obj of this._highlightGroup.children) {
        if (obj.userData.pulse) {
          obj.material.opacity = 0.3 + 0.3 * Math.sin(time * 4);
          obj.rotation.z += 0.02;
        }
      }

      // Gentle board bob
      if (this._boardGroup) {
        this._boardGroup.rotation.y = Math.sin(time * 0.3) * 0.005;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  _onClick(e) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this._handleClick(e.clientX - rect.left, e.clientY - rect.top);
  }

  _handleClick(clientX, clientY) {
    if (this.animating) return;
    const canvas = this.renderer.domElement;
    this._mouse.x = (clientX / canvas.clientWidth) * 2 - 1;
    this._mouse.y = -(clientY / canvas.clientHeight) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);

    // Check pieces first
    const pieceMeshes = [];
    this._pieceGroup.traverse(obj => {
      if (obj.isMesh) pieceMeshes.push(obj);
    });
    const pieceHits = this._raycaster.intersectObjects(pieceMeshes, false);

    // Also check board squares
    const squareHits = this._raycaster.intersectObjects(this.squareObjects, false);

    let row = -1, col = -1;

    if (pieceHits.length > 0) {
      // Find the parent group's userData (row could be 0, so check for undefined explicitly)
      let obj = pieceHits[0].object;
      while (obj && obj.userData.row === undefined) obj = obj.parent;
      if (obj && obj.userData.row !== undefined) {
        row = obj.userData.row;
        col = obj.userData.col;
      }
    } else if (squareHits.length > 0) {
      const sq = squareHits[0].object;
      row = sq.userData.row;
      col = sq.userData.col;
    }

    if (row >= 0 && this.onSquareClick) {
      this.onSquareClick(row, col);
    }
  }

  _onResize() {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  applyTheme(theme) {
    this.theme = theme;
    this._materials = {};
    if (this.scene) {
      this.scene.background = new THREE.Color(theme.bgColor);
      this.scene.fog = new THREE.FogExp2(theme.bgColor, 0.04);
      this._buildBoard();
      if (this.board) this.updateBoard(this.board);
    }
  }

  destroy() {
    if (this._frameId) cancelAnimationFrame(this._frameId);
    if (this.renderer) this.renderer.dispose();
  }
}
