/**
 * Keyboard + mouse input with pointer-lock mouse-look.
 *
 * Design notes:
 *  - Physical key codes (KeyW…) so WASD still works on non-QWERTY layouts.
 *  - `pressed` (held) vs `justPressed` (edge) — edges are consumed once per frame
 *    by the game loop calling `endFrame()`.
 *  - Input is *suspended*, not torn down, while a UI overlay is open, so the
 *    player never keeps running forward because a quiz popped up.
 */

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'interact'
  | 'useTool'
  | 'ability'
  | 'map'
  | 'codex'
  | 'scroll'
  | 'pause'
  | 'help'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'cameraToggle'
  | 'mount'
  | 'journalNext'
  | 'track';

const KEY_BINDINGS: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  KeyE: 'interact',
  KeyF: 'useTool',
  KeyQ: 'ability',
  KeyM: 'map',
  Tab: 'map',
  KeyJ: 'codex',
  KeyK: 'scroll',
  KeyT: 'track',
  Escape: 'pause',
  F1: 'help',
  Slash: 'help',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  KeyV: 'cameraToggle',
  KeyR: 'mount',
  Enter: 'journalNext',
};

export interface MouseState {
  /** Accumulated look delta for this frame, in radians-ish screen units. */
  dx: number;
  dy: number;
  left: boolean;
  right: boolean;
  leftEdge: boolean;
  rightEdge: boolean;
  wheel: number;
}

export class Input {
  readonly mouse: MouseState = { dx: 0, dy: 0, left: false, right: false, leftEdge: false, rightEdge: false, wheel: 0 };

  sensitivity = 1;
  invertY = false;

  private readonly held = new Set<Action>();
  private readonly edges = new Set<Action>();
  private readonly releases = new Set<Action>();
  private suspended = false;
  private locked = false;
  private readonly element: HTMLElement;
  private readonly disposers: Array<() => void> = [];

  constructor(element: HTMLElement) {
    this.element = element;
    this.bind();
  }

  // ---------------------------------------------------------------- queries

  pressed(action: Action): boolean {
    return !this.suspended && this.held.has(action);
  }

  justPressed(action: Action): boolean {
    return this.edges.has(action);
  }

  justReleased(action: Action): boolean {
    return this.releases.has(action);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Movement vector in local space: x = strafe, z = forward. Normalised. */
  moveAxis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.pressed('forward')) z += 1;
    if (this.pressed('back')) z -= 1;
    if (this.pressed('right')) x += 1;
    if (this.pressed('left')) x -= 1;
    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
  }

  // ---------------------------------------------------------------- control

  /**
   * Suspend gameplay input. Held keys are dropped so the player stops dead
   * rather than sliding while a modal is up.
   */
  setSuspended(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    this.held.clear();
    this.edges.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.left = false;
    this.mouse.right = false;
  }

  requestLock(): void {
    if (this.locked) return;
    // Pointer lock is refused in some embedded contexts (preview panes, cross
    // document iframes). That is not an error worth surfacing — the game is
    // still playable, mouse-look just needs a click on the page first.
    try {
      const result = this.element.requestPointerLock?.() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Call once at the end of every frame to clear per-frame edges and deltas. */
  endFrame(): void {
    this.edges.clear();
    this.releases.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.leftEdge = false;
    this.mouse.rightEdge = false;
    this.mouse.wheel = 0;
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }

  // ---------------------------------------------------------------- binding

  private bind(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEY_BINDINGS[e.code];
      // Tab / F1 / Space would otherwise scroll or move focus.
      if (action && (e.code === 'Tab' || e.code === 'Space' || e.code === 'F1' || e.code === 'Slash')) {
        e.preventDefault();
      }
      if (!action) return;
      // Menu keys must fire even while gameplay input is suspended.
      const isMenuKey = action === 'pause' || action === 'map' || action === 'codex' || action === 'help';
      if (this.suspended && !isMenuKey) return;
      if (e.repeat) return;
      this.held.add(action);
      this.edges.add(action);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEY_BINDINGS[e.code];
      if (!action) return;
      this.held.delete(action);
      this.releases.add(action);
    };

    const onBlur = () => {
      this.held.clear();
      this.mouse.left = false;
      this.mouse.right = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.locked || this.suspended) return;
      const scale = 0.0022 * this.sensitivity;
      this.mouse.dx += e.movementX * scale;
      this.mouse.dy += e.movementY * scale * (this.invertY ? -1 : 1);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.suspended) return;
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.leftEdge = true;
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightEdge = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (this.suspended) return;
      this.mouse.wheel += Math.sign(e.deltaY);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onLockChange = () => {
      this.locked = document.pointerLockElement === this.element;
      document.body.classList.toggle('is-playing', this.locked);
      if (!this.locked) onBlur();
    };

    const add = <K extends keyof WindowEventMap>(
      target: Window | Document | HTMLElement,
      type: K | string,
      fn: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, opts);
      this.disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    add(window, 'keydown', onKeyDown as EventListener);
    add(window, 'keyup', onKeyUp as EventListener);
    add(window, 'blur', onBlur as EventListener);
    add(window, 'mousemove', onMouseMove as EventListener);
    add(window, 'mousedown', onMouseDown as EventListener);
    add(window, 'mouseup', onMouseUp as EventListener);
    add(window, 'wheel', onWheel as EventListener, { passive: true });
    add(this.element, 'contextmenu', onContextMenu as EventListener);
    add(document, 'pointerlockchange', onLockChange as EventListener);
  }
}
