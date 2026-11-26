// ============================================================================
// DARK FANTASY ULTIMATE UI PACK — SVG ICON & PIXEL-GOTHIC FILIGREE SYSTEM
// Crisp vector icons + symmetrical pixel-gothic crests & spear ornaments.
// ============================================================================

const DUNGEON_SVG_PATHS = {
    crest: '<path d="M12 2L14.8 8.2L21 9.5L16 14L17.5 21L12 17.4L6.5 21L8 14L3 9.5L9.2 8.2L12 2Z"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    torch: '<path d="M12 2C14.5 5 16.5 7.2 16.5 10C16.5 12.5 14.5 14.2 12 14.2C9.5 14.2 7.5 12.5 7.5 10C7.5 7.8 9 6 10.2 4.5C10.2 6.5 11.5 7.2 12 5.5C12.3 4.3 12 3 12 2Z"/><path d="M9 14.5H15L13.6 22H10.4L9 14.5Z"/><path d="M7.5 14.5H16.5"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 7V17M9.5 9.5H14.5M9.5 14.5H14.5"/>',
    ingot: '<path d="M4 17L7 9H17L20 17H4Z"/><path d="M7 9L9.5 17M17 9L14.5 17"/><path d="M9 5L12 3L15 5"/>',
    satchel: '<path d="M9 3H15M10 3V6.5L5.5 14.5C4.6 16.1 5.7 18.2 7.6 18.2H16.4C18.3 18.2 19.4 16.1 18.5 14.5L14 6.5V3"/><path d="M7 13.5H17"/>',
    armory: '<path d="M12 3L4.5 6.2V11.8C4.5 16.5 7.7 20.6 12 22C16.3 20.6 19.5 16.5 19.5 11.8V6.2L12 3Z"/><path d="M12 6.5V18M8.5 10.5H15.5"/>',
    codex: '<path d="M4.5 4.5C4.5 3.7 5.2 3 6 3H18.5V19.5H6C5.2 19.5 4.5 20.2 4.5 21V4.5Z"/><path d="M4.5 19.5C4.5 18.4 5.4 17.5 6.5 17.5H19.5V21H6.5C5.4 21 4.5 20.3 4.5 19.5Z"/><path d="M9 7.5H15M9 11H13.5"/>',
    map: '<polygon points="12 2.5 14.8 9.2 21.5 12 14.8 14.8 12 21.5 9.2 14.8 2.5 12 9.2 9.2 12 2.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5V5M12 19V21.5M2.5 12H5M19 12H21.5M5.3 5.3L7.1 7.1M16.9 16.9L18.7 18.7M18.7 5.3L16.9 7.1M7.1 16.9L5.3 18.7"/>',
    soundOn: '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19 11 5"/><path d="M15.2 8.8C16.9 10.5 16.9 13.5 15.2 15.2M18.2 6C21.5 9.3 21.5 14.7 18.2 18"/>',
    soundOff: '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19 11 5"/><path d="M16 9.5L21 14.5M21 9.5L16 14.5"/>',
    save: '<path d="M5 3.5H16.2L19.5 6.8V20.5H5V3.5Z"/><path d="M8.5 3.5V8.5H15.5V3.5"/><rect x="8" y="13" width="8" height="7.5"/>',
    seed: '<polygon points="12 2.5 20.5 7.5 20.5 16.5 12 21.5 3.5 16.5 3.5 7.5 12 2.5"/><path d="M12 2.5V12M20.5 7.5L12 12M3.5 7.5L12 12"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M8 3V6.5M16 3V6.5M3.5 9.5H20.5"/><rect x="10" y="13" width="4" height="4" fill="currentColor"/>',
    reset: '<path d="M4.5 12A7.5 7.5 0 1 1 6.7 17.3"/><polyline points="4 17.5 4 12.5 9 12.5"/>',
    sword: '<polygon points="20.5 3.5 19.8 8.2 10.6 17.4 6.6 13.4 15.8 4.2 20.5 3.5"/><path d="M9.2 14.8L17.8 6.2M5.2 12L12 18.8M7.6 16.4L4.2 19.8M3.5 19.2L4.8 20.5"/>',
    arcane: '<path d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6L12 2.5Z"/><circle cx="12" cy="12" r="2.2"/>',
    mastery: '<path d="M12 2.5L15 8.5L21 9.5L16.5 14L17.8 20.5L12 17.2L6.2 20.5L7.5 14L3 9.5L9 8.5L12 2.5Z"/>',
    shield: '<path d="M12 3L5 6V11.5C5 16.2 8 20.1 12 21.5C16 20.1 19 16.2 19 11.5V6L12 3Z"/>',
    swap: '<polyline points="7 8 3.5 11.5 7 15"/><path d="M3.5 11.5H16"/><polyline points="17 9 20.5 12.5 17 16"/><path d="M20.5 12.5H8"/>',
    overdrive: '<polygon points="13 2 4.5 13.5 11.5 13.5 10.5 22 19.5 10.5 12.5 10.5 13 2"/>',
    feather: '<path d="M20.2 3.8C16.5 3.8 11.2 6.4 8.2 11.5L4 20L12.5 15.8C17.6 12.8 20.2 7.5 20.2 3.8Z"/><path d="M4 20L14.5 9.5"/>',
    flee: '<path d="M13.5 5.5L19.5 12L13.5 18.5M19.5 12H6.5M3.5 6V18"/>',
    heart: '<path d="M12 20.5L4.8 13.2C2.8 11.1 2.8 7.7 4.9 5.7C7 3.7 10.1 4 12 6.3C13.9 4 17 3.7 19.1 5.7C21.2 7.7 21.2 11.1 19.2 13.2L12 20.5Z"/>',
    bolt: '<polygon points="13 2.5 5.5 13.2 11.5 13.2 10.8 21.5 18.5 10.8 12.5 10.8 13 2.5"/>',
    skull: '<path d="M12 3.5C7.6 3.5 4.5 6.6 4.5 10.8C4.5 13.4 5.8 15.5 7.5 16.7V20.5H16.5V16.7C18.2 15.5 19.5 13.4 19.5 10.8C19.5 6.6 16.4 3.5 12 3.5Z"/><circle cx="9.2" cy="11" r="1.5" fill="currentColor"/><circle cx="14.8" cy="11" r="1.5" fill="currentColor"/><path d="M10.5 20.5V18M13.5 20.5V18"/>',
    crown: '<polygon points="3.5 18.5 5 7.5 9.8 12 12 5.5 14.2 12 19 7.5 20.5 18.5 3.5 18.5"/><path d="M3.5 21H20.5"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2V6M12 18V22M2 12H6M18 12H22"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    scroll: '<path d="M6.5 4H18.5V17.5C18.5 19.2 17.2 20.5 15.5 20.5H5.5C4.4 20.5 3.5 19.6 3.5 18.5V16.5H14.5"/><path d="M6.5 4C5.4 4 4.5 4.9 4.5 6V16.5"/><path d="M9 8.5H15M9 12H14"/>',
    helm: '<path d="M5 12C5 7.2 8 4 12 4C16 4 19 7.2 19 12V19.5L15 17.5V13H9V17.5L5 19.5V12Z"/><path d="M12 4V13M8 10.5H16"/>',
    cuirass: '<path d="M7.5 4L4 7.5L6.5 11V20H17.5V11L20 7.5L16.5 4L14 6.5H10L7.5 4Z"/><path d="M12 6.5V19.5M7 14H17"/>',
    greaves: '<path d="M7 4H17L18 11.5L16.5 20.5H13.2L12.5 12H11.5L10.8 20.5H7.5L6 11.5L7 4Z"/><path d="M7 8H17"/>',
    sabatons: '<path d="M8 4H14.5V13.5L19.5 16.5V19.5H5.5V15.5L8 13V4Z"/><path d="M8 8.5H14.5"/>',
    relic: '<polygon points="12 3 18.5 9.5 12 21 5.5 9.5 12 3"/><path d="M5.5 9.5H18.5M12 3V21"/>',
    chest: '<rect x="3.5" y="7" width="17" height="13" rx="1"/><path d="M3.5 11.5H20.5M8 7V20M16 7V20"/><rect x="10.5" y="10" width="3" height="3.5" fill="currentColor"/>',
    campfire: '<path d="M12 3.5C14.5 6.5 16 8.5 16 11C16 13.2 14.2 15 12 15C9.8 15 8 13.2 8 11C8 8.5 9.5 6.5 12 3.5Z"/><path d="M4.5 17.5L19.5 21M19.5 17.5L4.5 21"/>',
    shrine: '<polygon points="12 2.5 15.5 7.5 12 12.5 8.5 7.5 12 2.5"/><path d="M7.5 15H16.5L18.5 21H5.5L7.5 15Z"/>',
    scales: '<path d="M12 3.5V20.5M5 7.5H19M8 20.5H16"/><path d="M5 7.5L2.5 14H7.5L5 7.5ZM19 7.5L16.5 14H21.5L19 7.5Z"/>',
    stairs: '<path d="M4 19.5H9V15H14V10.5H19V6"/><rect x="3.5" y="4" width="17" height="16.5"/>',
    trophy: '<path d="M7 4H17V10C17 12.8 14.8 15 12 15C9.2 15 7 12.8 7 10V4Z"/><path d="M7 6H4V9C4 10.7 5.3 12 7 12M17 6H20V9C20 10.7 18.7 12 17 12"/><path d="M12 15V19.5M8.5 19.5H15.5"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="10" rx="1"/><path d="M8.5 10.5V7.5C8.5 5.6 10.1 4 12 4C13.9 4 15.5 5.6 15.5 7.5V10.5"/>',
    check: '<polyline points="4.5 12.5 9.5 17.5 19.5 6.5"/>',
    auto: '<polygon points="12 3 19.5 7.5 19.5 16.5 12 21 4.5 16.5 4.5 7.5 12 3"/><circle cx="12" cy="12" r="3"/>',
    speed: '<polygon points="4.5 6 12.5 12 4.5 18 4.5 6"/><polygon points="12.5 6 20.5 12 12.5 18 12.5 6"/>',
    close: '<path d="M6 6L18 18M18 6L6 18"/>'
};

function icon(name, size = 14, extraClass = '') {
    const body = DUNGEON_SVG_PATHS[name] || DUNGEON_SVG_PATHS.crest;
    const cls = extraClass ? `svg-ico ${extraClass}` : 'svg-ico';
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Carved Stone Keystone Arch + Symmetrical Pixel-Gothic Filigree Crest
function filigreeBannerCrestSvg(flipped = false) {
    const tf = flipped ? 'transform="scale(1,-1) translate(0,-16)"' : '';
    return `<svg class="filigree-crest-svg" width="116" height="16" viewBox="0 0 116 16" shape-rendering="crispEdges" aria-hidden="true">
        <g ${tf}>
            <!-- Stepped Carved Basalt Keystone Base -->
            <rect x="48" y="0" width="20" height="4" fill="#2e292d"/>
            <rect x="48" y="0" width="20" height="1" fill="#595055"/>
            <rect x="34" y="4" width="48" height="4" fill="#272327"/>
            <rect x="34" y="4" width="48" height="1" fill="#4c4449"/>
            <rect x="18" y="8" width="80" height="4" fill="#221e22"/>
            <rect x="18" y="8" width="80" height="1" fill="#423b40"/>
            <rect x="4" y="12" width="108" height="4" fill="#1b181c"/>
            <rect x="4" y="12" width="108" height="1" fill="#383236"/>
            <!-- Mortar joints & stone cracks -->
            <rect x="57" y="1" width="1" height="3" fill="#121013"/>
            <rect x="43" y="4" width="1" height="4" fill="#121013"/>
            <rect x="72" y="4" width="1" height="4" fill="#121013"/>
            <rect x="29" y="8" width="1" height="4" fill="#121013"/>
            <rect x="86" y="8" width="1" height="4" fill="#121013"/>
            <rect x="14" y="12" width="2" height="2" fill="#0f0d10"/>
            <rect x="100" y="12" width="2" height="2" fill="#0f0d10"/>
            <!-- Champagne-Bronze Gothic Filigree Inlay -->
            <rect x="56" y="1" width="4" height="2" fill="#e6d4b8"/>
            <rect x="52" y="3" width="12" height="2" fill="#c7ae91"/>
            <rect x="46" y="5" width="6" height="2" fill="#9c836a"/>
            <rect x="56" y="5" width="4" height="2" fill="#e6d4b8"/>
            <rect x="64" y="5" width="6" height="2" fill="#9c836a"/>
            <rect x="38" y="7" width="10" height="2" fill="#8e7660"/>
            <rect x="50" y="7" width="16" height="2" fill="#c7ae91"/>
            <rect x="68" y="7" width="10" height="2" fill="#8e7660"/>
            <rect x="26" y="10" width="14" height="2" fill="#6e5a49"/>
            <rect x="44" y="10" width="6" height="2" fill="#9c836a"/>
            <rect x="54" y="10" width="8" height="2" fill="#d8c2a6"/>
            <rect x="66" y="10" width="6" height="2" fill="#9c836a"/>
            <rect x="76" y="10" width="14" height="2" fill="#6e5a49"/>
            <rect x="10" y="13" width="96" height="2" fill="#8e7660"/>
        </g>
    </svg>`;
}

// Carved Runic Stone Stele / Obelisk Column with Bronze Spear Finial
function gothicSpearOrnamentSvg() {
    return `<svg class="gothic-spear-svg" width="18" height="96" viewBox="0 0 18 96" fill="none" aria-hidden="true">
        <!-- Carved Stone Obelisk Backing -->
        <rect x="5" y="13" width="8" height="70" fill="#221e23" stroke="#110f12" stroke-width="1"/>
        <line x1="6" y1="14" x2="6" y2="82" stroke="#474045" stroke-width="1"/>
        <!-- Stone Capital & Pedestal Base -->
        <rect x="3" y="11" width="12" height="4" fill="#322c31" stroke="#121013" stroke-width="1"/>
        <line x1="4" y1="12" x2="14" y2="12" stroke="#595056" stroke-width="1"/>
        <rect x="3" y="81" width="12" height="4" fill="#322c31" stroke="#121013" stroke-width="1"/>
        <line x1="4" y1="82" x2="14" y2="82" stroke="#595056" stroke-width="1"/>
        <!-- Stone Mortar Joints & Chipped Notches -->
        <line x1="5" y1="30" x2="13" y2="30" stroke="#110f12" stroke-width="1"/>
        <line x1="6" y1="31" x2="12" y2="31" stroke="#3f393e" stroke-width="1"/>
        <line x1="5" y1="66" x2="13" y2="66" stroke="#110f12" stroke-width="1"/>
        <line x1="6" y1="67" x2="12" y2="67" stroke="#3f393e" stroke-width="1"/>
        <path d="M5 22L7 24M13 56L10 58" stroke="#100e11" stroke-width="1"/>
        <!-- Top Bronze Fleur-de-lis Spearhead -->
        <path d="M9 1L12.5 8L9 12L5.5 8L9 1Z" fill="#c7ae91"/>
        <path d="M3.5 10C5.5 9 7.2 11 9 13C10.8 11 12.5 9 14.5 10" stroke="#9c836a" stroke-width="1.2"/>
        <!-- Center Carved Rune Diamond Clasp -->
        <line x1="9" y1="15" x2="9" y2="81" stroke="#7d6754" stroke-width="1"/>
        <polygon points="9 41 13.5 48 9 55 4.5 48" fill="#181519" stroke="#c7ae91" stroke-width="1.2"/>
        <circle cx="9" cy="48" r="1.6" fill="#e2ceb4"/>
        <!-- Bottom Bronze Finial -->
        <path d="M3.5 86C5.5 87 7.2 85 9 83C10.8 85 12.5 87 14.5 86" stroke="#9c836a" stroke-width="1.2"/>
        <path d="M9 95L12.5 88L9 84L5.5 88L9 95Z" fill="#9c836a"/>
    </svg>`;
}

// Chiseled Dungeon Corner Stone Bracket / Boss for Viewport Archway
function stoneCornerKeystoneSvg(corner = 'tl') {
    const transforms = {
        tl: '',
        tr: 'transform="translate(28,0) scale(-1,1)"',
        bl: 'transform="translate(0,28) scale(1,-1)"',
        br: 'transform="translate(28,28) scale(-1,-1)"'
    };
    const tf = transforms[corner] || '';
    return `<svg class="stone-corner-svg" width="28" height="28" viewBox="0 0 28 28" shape-rendering="crispEdges" aria-hidden="true">
        <g ${tf}>
            <!-- Stepped Ashlar Corner Stone Block -->
            <path d="M0 0H26V8H14V14H8V26H0V0Z" fill="#2a2529"/>
            <!-- Top & Left Chiseled Stone Bevel Highlight -->
            <rect x="0" y="0" width="26" height="2" fill="#52494f"/>
            <rect x="0" y="0" width="2" height="26" fill="#463e44"/>
            <!-- Bottom & Right Cut-Stone Shadow -->
            <rect x="14" y="7" width="12" height="2" fill="#110e12"/>
            <rect x="8" y="13" width="6" height="2" fill="#110e12"/>
            <rect x="0" y="25" width="8" height="2" fill="#110e12"/>
            <rect x="25" y="0" width="2" height="8" fill="#110e12"/>
            <rect x="7" y="14" width="2" height="12" fill="#110e12"/>
            <!-- Hairline Rock Crack & Mortar Groove -->
            <rect x="16" y="2" width="1" height="5" fill="#151216"/>
            <rect x="2" y="16" width="5" height="1" fill="#151216"/>
            <rect x="9" y="8" width="2" height="1" fill="#151216"/>
            <rect x="8" y="9" width="1" height="2" fill="#151216"/>
            <!-- Recessed Bronze Rivet & Gothic Corner Inlay -->
            <rect x="3" y="3" width="6" height="6" fill="#181519"/>
            <rect x="4" y="4" width="4" height="4" fill="#c7ae91"/>
            <rect x="5" y="5" width="2" height="2" fill="#ead8be"/>
            <rect x="11" y="3" width="9" height="2" fill="#8e7660"/>
            <rect x="3" y="11" width="2" height="9" fill="#8e7660"/>
        </g>
    </svg>`;
}

// ============================================================================
// ILLUSTRATED DARK-FANTASY COMBAT ATTACK & CLASS SKILL SVG EMBLEMS (40x40)
// Multi-layered metallic bevels, weapon silhouettes, & arcane energy trails.
// ============================================================================
let _edCombatSvgSeq = 0;
const _edCanvasSvgImgCache = {};

function _buildCombatSvgDefs(p) {
    return `<defs>
        <linearGradient id="${p}s" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f6f9fc"/>
            <stop offset="48%" stop-color="#b4c3d2"/>
            <stop offset="100%" stop-color="#536171"/>
        </linearGradient>
        <linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff1c7"/>
            <stop offset="52%" stop-color="#dfb264"/>
            <stop offset="100%" stop-color="#7c5321"/>
        </linearGradient>
        <linearGradient id="${p}r" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffe0e2"/>
            <stop offset="45%" stop-color="#eb4852"/>
            <stop offset="100%" stop-color="#6e1118"/>
        </linearGradient>
        <linearGradient id="${p}c" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ebffff"/>
            <stop offset="50%" stop-color="#56d4ff"/>
            <stop offset="100%" stop-color="#195d99"/>
        </linearGradient>
        <linearGradient id="${p}f" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff9d2"/>
            <stop offset="48%" stop-color="#ff8c28"/>
            <stop offset="100%" stop-color="#8f1812"/>
        </linearGradient>
        <linearGradient id="${p}e" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e8ffec"/>
            <stop offset="52%" stop-color="#4ad97a"/>
            <stop offset="100%" stop-color="#146132"/>
        </linearGradient>
        <linearGradient id="${p}v" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f7e6ff"/>
            <stop offset="50%" stop-color="#be6eff"/>
            <stop offset="100%" stop-color="#481a82"/>
        </linearGradient>
    </defs>`;
}

const COMBAT_SKILL_SVG_BODIES = {
    // --- BASIC ATTACKS PER HERO CLASS ---
    atk_sword: (p) => `
        <path d="M5.5 16.5C10.5 5.5 24.5 3.5 35.5 11.5C26.5 8.5 14.5 10.8 8.8 20.5Z" fill="url(#${p}r)" opacity="0.92"/>
        <path d="M7.5 14C13.5 6.5 24.5 5.5 34.5 11.2" stroke="#fff3cf" stroke-width="1.35" stroke-linecap="round" fill="none"/>
        <polygon points="10.2 25.8 28.8 7.2 35.2 4.8 12.2 27.8" fill="url(#${p}s)"/>
        <polygon points="12.2 27.8 35.2 4.8 32.8 11.2 14.2 29.8" fill="#5d6c7d"/>
        <path d="M10.2 25.8L28.8 7.2L35.2 4.8L32.8 11.2L14.2 29.8Z" stroke="#181419" stroke-width="0.95" fill="none"/>
        <line x1="14" y1="26" x2="29.5" y2="10.5" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
        <polygon points="6.2 22.2 9.4 21.2 18.8 30.6 17.8 33.8 14.6 31.4 8.6 25.4" fill="url(#${p}g)" stroke="#1a120d" stroke-width="0.95"/>
        <polygon points="10.2 27.8 12.4 30 7.4 35 5.2 32.8" fill="#5e3620" stroke="#1a120d" stroke-width="0.9"/>
        <circle cx="5.2" cy="34.8" r="2.3" fill="url(#${p}g)" stroke="#1a120d" stroke-width="0.95"/>
        <polygon points="29 16 30.2 19.2 33.5 20.4 30.2 21.6 29 24.8 27.8 21.6 24.5 20.4 27.8 19.2" fill="#fff3cf"/>`,

    atk_bow: (p) => `
        <line x1="9.5" y1="7.5" x2="12" y2="27.5" stroke="#d8e3ee" stroke-width="1.1" opacity="0.85"/>
        <line x1="32.5" y1="30.5" x2="12" y2="27.5" stroke="#d8e3ee" stroke-width="1.1" opacity="0.85"/>
        <path d="M8.5 6.5C18.5 5.5 26.5 9.5 30.5 15.5C34.5 21.5 34.5 28.5 33.5 31.5" stroke="url(#${p}g)" stroke-width="3.1" stroke-linecap="round" fill="none"/>
        <path d="M8.5 6.5C18.5 5.5 26.5 9.5 30.5 15.5" stroke="#fff3cf" stroke-width="0.9" stroke-linecap="round" fill="none"/>
        <polygon points="9.5 27.2 14.5 31 11.2 32.8 6.8 29.2" fill="url(#${p}e)"/>
        <polygon points="12.8 30.5 16.5 34.2 13.8 35.8 10.2 32.2" fill="url(#${p}e)"/>
        <line x1="10" y1="30" x2="32.5" y2="7.5" stroke="#e9dec9" stroke-width="2.1" stroke-linecap="round"/>
        <polygon points="35.8 4.2 27.2 7.2 30.5 9.5 32.8 12.8" fill="url(#${p}s)" stroke="#161318" stroke-width="0.85"/>
        <path d="M18 14L25 7M23 23L31 15" stroke="#b8f5ff" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`,

    atk_mace: (p) => `
        <circle cx="23.5" cy="16.5" r="10.2" stroke="url(#${p}g)" stroke-width="1.2" stroke-dasharray="3.2 2.2" fill="none" opacity="0.85"/>
        <line x1="6.5" y1="33.5" x2="21.5" y2="18.5" stroke="#6c4327" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="6.5" y1="33.5" x2="21.5" y2="18.5" stroke="url(#${p}g)" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="6.2" cy="33.8" r="2.2" fill="url(#${p}g)" stroke="#1b130e" stroke-width="0.9"/>
        <polygon points="23.5 5.5 26.5 13.2 34.5 16.5 26.5 19.8 23.5 27.5 20.5 19.8 12.5 16.5 20.5 13.2" fill="url(#${p}g)" stroke="#1d140e" stroke-width="0.95"/>
        <polygon points="18.2 11.2 23.5 13.8 28.8 11.2 26.2 16.5 28.8 21.8 23.5 19.2 18.2 21.8 20.8 16.5" fill="url(#${p}s)" stroke="#1d140e" stroke-width="0.8"/>
        <circle cx="23.5" cy="16.5" r="3.1" fill="#fff9de"/>`,

    atk_staff: (p) => `
        <circle cx="25.5" cy="14.5" r="9.2" fill="url(#${p}v)" opacity="0.28"/>
        <line x1="6.5" y1="34" x2="21" y2="19.5" stroke="#4f3020" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M17.5 22.5C14.5 17 17 10.5 23.5 7.5C20 11.5 19.5 16.5 22 19.5" fill="url(#${p}g)" stroke="#1b120e" stroke-width="0.9"/>
        <path d="M19.5 20.5C24.5 23.5 31 21 33.5 14.5C29.5 18 24.5 18.5 21.5 16" fill="url(#${p}g)" stroke="#1b120e" stroke-width="0.9"/>
        <circle cx="25.8" cy="14.2" r="5.6" fill="url(#${p}v)" stroke="#fff0ff" stroke-width="0.9"/>
        <circle cx="24.2" cy="12.6" r="2" fill="#ffffff"/>
        <polyline points="31 6 34.5 9.5 31.5 11.5 35.5 15" stroke="#f0b8ff" stroke-width="1.4" stroke-linecap="round" fill="none"/>
        <polygon points="12 10 13 12.6 15.6 13.6 13 14.6 12 17.2 11 14.6 8.4 13.6 11 12.6" fill="#f7d9ff"/>`,

    // --- PRIMARY CLASS SKILLS ---
    skill_default: (p) => `
        <polygon points="20 3.5 24.5 14.5 36.5 20 24.5 25.5 20 36.5 15.5 25.5 3.5 20 15.5 14.5" fill="url(#${p}v)" stroke="#1b1324" stroke-width="0.95"/>
        <polygon points="20 8 22.8 17.2 32 20 22.8 22.8 20 32 17.2 22.8 8 20 17.2 17.2" fill="url(#${p}g)"/>
        <circle cx="20" cy="20" r="3.4" fill="#ffffff"/>`,

    skill_shield_bash: (p) => `
        <path d="M25.5 8.5C32.5 12.5 34.5 23.5 26.5 31.5" stroke="url(#${p}c)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path d="M30.5 12C36 16 36.5 23 31 28.5" stroke="#e6ffff" stroke-width="1.6" stroke-linecap="round" fill="none"/>
        <path d="M6.5 9.5L21.5 6.5L23.5 19.5C23.5 26.8 17.8 32.2 13.5 34.5C8.8 31.5 5.5 25.5 6.5 9.5Z" fill="url(#${p}s)" stroke="url(#${p}g)" stroke-width="2"/>
        <path d="M14.5 8.2V32.5M7.5 18.5H22.5" stroke="url(#${p}g)" stroke-width="1.6"/>
        <polygon points="14.5 14 18 18.5 14.5 23 11 18.5" fill="url(#${p}c)" stroke="#14202b" stroke-width="0.8"/>
        <polygon points="33.5 16.5 34.8 19.2 37.5 20.5 34.8 21.8 33.5 24.5 32.2 21.8 29.5 20.5 32.2 19.2" fill="#ffffff"/>`,

    skill_armor_piercer: (p) => `
        <path d="M9 9.5L17.5 7V18.5L14.5 22.5L17 32.5C11.5 29.8 8.5 24.5 9 9.5Z" fill="url(#${p}s)" stroke="#1a161c" stroke-width="1"/>
        <path d="M31 11.5L22.5 8.5V17.5L25.5 21.5L22.5 33C28 30.2 31.5 25 31 11.5Z" fill="#6b7a8c" stroke="#1a161c" stroke-width="1"/>
        <line x1="5" y1="31" x2="33.5" y2="9.5" stroke="url(#${p}g)" stroke-width="3" stroke-linecap="round"/>
        <polygon points="36.5 7 26.8 9.8 30.2 12.2 32.2 16" fill="#fff4cc" stroke="#6e4715" stroke-width="0.9"/>
        <polygon points="19 4.5 21.5 8 18.5 9.5" fill="url(#${p}g)"/>
        <polygon points="20.5 30 23.5 34 19.5 35" fill="url(#${p}s)"/>`,

    skill_holy_purify: (p) => `
        <circle cx="20" cy="19" r="12" fill="url(#${p}e)" opacity="0.22"/>
        <circle cx="20" cy="19" r="9.5" stroke="url(#${p}g)" stroke-width="1.3" stroke-dasharray="4 2" fill="none"/>
        <polygon points="20 4.5 23 15.5 34 18.5 23 21.5 20 33.5 17 21.5 6 18.5 17 15.5" fill="url(#${p}g)" stroke="#1d150d" stroke-width="0.9"/>
        <polygon points="20 9 21.6 16.8 29.5 18.5 21.6 20.2 20 28.5 18.4 20.2 10.5 18.5 18.4 16.8" fill="#fffbe0"/>
        <path d="M10 10C10 7.5 11.8 6 11.8 6C11.8 6 13.6 7.5 13.6 10A1.8 1.8 0 1 1 10 10Z" fill="url(#${p}e)"/>
        <path d="M27.5 28.5C27.5 26 29.3 24.5 29.3 24.5C29.3 24.5 31.1 26 31.1 28.5A1.8 1.8 0 1 1 27.5 28.5Z" fill="url(#${p}e)"/>`,

    skill_hellfire: (p) => `
        <path d="M20 3.5C26 9.5 34 14.5 33.5 23.5C33 31.5 27 36.5 20 36.5C13 36.5 7 31.5 6.5 23.5C6 16.5 10.5 11.5 14 8.5C13.5 12.5 15.8 14 17.5 11C18.8 8.8 18.5 6 20 3.5Z" fill="url(#${p}r)" stroke="#240b0d" stroke-width="0.95"/>
        <path d="M20.5 10.5C24.5 14.5 28.8 18.5 28.5 24.5C28.2 29.8 24.8 33.5 20 33.5C15.2 33.5 11.8 29.8 11.5 24.5C11.2 19.5 14.8 16.2 17 13.8C17.2 16.8 19.2 17.2 20.5 10.5Z" fill="url(#${p}f)"/>
        <circle cx="20" cy="26" r="4.8" fill="#fff9d6"/>
        <polygon points="8 12 10.5 9.5 11 13" fill="#ffae38"/>
        <polygon points="31 11 33.5 14 29.8 14.5" fill="#ffae38"/>`,

    // --- MASTERY LV.5 CLASS SKILLS ---
    skill_mastery_default: (p) => `
        <line x1="7.5" y1="32.5" x2="32.5" y2="7.5" stroke="url(#${p}s)" stroke-width="3" stroke-linecap="round"/>
        <line x1="32.5" y1="32.5" x2="7.5" y2="7.5" stroke="url(#${p}s)" stroke-width="3" stroke-linecap="round"/>
        <line x1="6" y1="27" x2="13" y2="34" stroke="url(#${p}g)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="34" y1="27" x2="27" y2="34" stroke="url(#${p}g)" stroke-width="2.4" stroke-linecap="round"/>
        <polygon points="20 5 22.8 12.2 30.5 13 24.6 18 26.4 25.5 20 21.4 13.6 25.5 15.4 18 9.5 13 17.2 12.2" fill="url(#${p}g)" stroke="#1c130c" stroke-width="0.95"/>`,

    skill_whirlwind: (p) => `
        <path d="M20 5C30 5 36 12.5 35 21.5C32.5 14.5 26.5 11 19.5 11.5L22 15L12.5 10.5L21 4Z" fill="url(#${p}c)" stroke="#112230" stroke-width="0.85"/>
        <path d="M20 35C10 35 4 27.5 5 18.5C7.5 25.5 13.5 29 20.5 28.5L18 25L27.5 29.5L19 36Z" fill="url(#${p}s)" stroke="#112230" stroke-width="0.85"/>
        <circle cx="20" cy="20" r="5.2" fill="url(#${p}g)" stroke="#18120c" stroke-width="0.9"/>
        <circle cx="20" cy="20" r="2.2" fill="#ffffff"/>`,

    skill_viper_volley: (p) => `
        <line x1="7" y1="31" x2="26" y2="7" stroke="#cfe8d5" stroke-width="2" stroke-linecap="round"/>
        <line x1="8" y1="32" x2="33" y2="14" stroke="#cfe8d5" stroke-width="2" stroke-linecap="round"/>
        <line x1="9" y1="33" x2="34" y2="24" stroke="#cfe8d5" stroke-width="2" stroke-linecap="round"/>
        <polygon points="28.5 4 21.5 7.5 24.8 9 26.5 12" fill="url(#${p}e)" stroke="#0d2616" stroke-width="0.8"/>
        <polygon points="36 12 28.5 13.2 31.2 15.8 31.8 19.2" fill="url(#${p}e)" stroke="#0d2616" stroke-width="0.8"/>
        <polygon points="37 23 29.5 21.8 31.2 25 30.5 28.2" fill="url(#${p}e)" stroke="#0d2616" stroke-width="0.8"/>
        <circle cx="27.5" cy="15.5" r="1.5" fill="#7dff9b"/>
        <circle cx="22.5" cy="27.5" r="1.7" fill="#7dff9b"/>`,

    skill_divine_aegis: (p) => `
        <path d="M12 16C6.5 13.5 4 9 4.5 5.5C8.5 6.5 12 9.5 13.5 13Z" fill="url(#${p}g)"/>
        <path d="M11.5 21C6 20 3.5 16.5 4 13C8 14 11 16.5 12.5 19.5Z" fill="#f5e3be"/>
        <path d="M28 16C33.5 13.5 36 9 35.5 5.5C31.5 6.5 28 9.5 26.5 13Z" fill="url(#${p}g)"/>
        <path d="M28.5 21C34 20 36.5 16.5 36 13C32 14 29 16.5 27.5 19.5Z" fill="#f5e3be"/>
        <ellipse cx="20" cy="6.5" rx="7.5" ry="2.2" stroke="#fff4c9" stroke-width="1.5" fill="none"/>
        <path d="M20 10L30 13.5V21.5C30 28.2 25.5 33.2 20 35.8C14.5 33.2 10 28.2 10 21.5V13.5L20 10Z" fill="url(#${p}g)" stroke="#1d140c" stroke-width="1"/>
        <path d="M20 13.5V32M14 20.5H26" stroke="#fffbe0" stroke-width="2" stroke-linecap="round"/>`,

    skill_frost_nova: (p) => `
        <circle cx="20" cy="20" r="13.5" stroke="url(#${p}c)" stroke-width="1.3" stroke-dasharray="3 2.5" fill="none"/>
        <polygon points="20 3 23.2 15.2 35 11.5 25.5 20 35 28.5 23.2 24.8 20 37 16.8 24.8 5 28.5 14.5 20 5 11.5 16.8 15.2" fill="url(#${p}c)" stroke="#0d2638" stroke-width="0.9"/>
        <polygon points="20 10.5 22.2 17.8 29.5 20 22.2 22.2 20 29.5 17.8 22.2 10.5 20 17.8 17.8" fill="#ffffff"/>`,

    // --- OVERDRIVE ULTIMATES ---
    ult_default: (p) => `
        <polygon points="20 2.5 23.5 11.5 32.5 7.5 28.5 16.5 37.5 20 28.5 23.5 32.5 32.5 23.5 28.5 20 37.5 16.5 28.5 7.5 32.5 11.5 23.5 2.5 20 11.5 16.5 7.5 7.5 16.5 11.5" fill="url(#${p}f)" opacity="0.88"/>
        <polygon points="22 4 11 21 19.5 21 17.5 36 29.5 18.5 21 18.5" fill="url(#${p}g)" stroke="#1f1209" stroke-width="1"/>
        <polygon points="21.2 8.5 14.2 19.8 19.8 19.8 18.8 30.5 26.2 19.5 20.5 19.5" fill="#fffbe3"/>`,

    ult_bastion: (p) => `
        <polygon points="12.5 9.5 14 4.5 17.5 7.5 20 3.5 22.5 7.5 26 4.5 27.5 9.5" fill="url(#${p}g)" stroke="#1d140c" stroke-width="0.85"/>
        <path d="M20 11L31.5 14.5V23C31.5 29.8 26.5 34.8 20 37.2C13.5 34.8 8.5 29.8 8.5 23V14.5L20 11Z" fill="url(#${p}s)" stroke="url(#${p}g)" stroke-width="2"/>
        <polygon points="20 6 22.2 11 21.6 33.5 20 36.5 18.4 33.5 17.8 11" fill="url(#${p}g)" stroke="#1d140c" stroke-width="0.8"/>
        <line x1="14" y1="14" x2="26" y2="14" stroke="#fff6d1" stroke-width="2.2" stroke-linecap="round"/>`,

    ult_arrow_rain: (p) => `
        <path d="M6 12C13 4.5 25 4.5 34 11" stroke="url(#${p}g)" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <line x1="9" y1="8" x2="18" y2="30" stroke="#fff3cf" stroke-width="1.9" stroke-linecap="round"/>
        <polygon points="19.5 33.5 14.8 28.5 17.8 28.8 19.8 26.5" fill="url(#${p}g)"/>
        <line x1="16.5" y1="6.5" x2="26.5" y2="31.5" stroke="#fff3cf" stroke-width="2.2" stroke-linecap="round"/>
        <polygon points="28 35.5 23 30.2 26.2 30.5 28.2 28" fill="url(#${p}f)"/>
        <line x1="25" y1="8" x2="34" y2="29" stroke="#fff3cf" stroke-width="1.9" stroke-linecap="round"/>
        <polygon points="35.5 32.5 30.8 27.5 33.8 27.8 35.8 25.5" fill="url(#${p}g)"/>
        <line x1="5" y1="16" x2="11.5" y2="31.5" stroke="#dfb264" stroke-width="1.6" stroke-linecap="round"/>`,

    ult_miracle: (p) => `
        <circle cx="20" cy="20" r="14" stroke="url(#${p}g)" stroke-width="1.3" stroke-dasharray="3 2" fill="none"/>
        <path d="M20 18C12 15 5.5 10.5 5 5C11 6 16.5 10 20 15C23.5 10 29 6 35 5C34.5 10.5 28 15 20 18Z" fill="url(#${p}g)"/>
        <path d="M20 22C12 24 6 28 5.5 33.5C11.5 32.5 16.5 28.5 20 24.5C23.5 28.5 28.5 32.5 34.5 33.5C34 28 28 24 20 22Z" fill="#f3dfc1"/>
        <polygon points="20 4 22.8 17.2 35 20 22.8 22.8 20 36 17.2 22.8 5 20 17.2 17.2" fill="#fffdf0" stroke="url(#${p}g)" stroke-width="0.9"/>`,

    ult_meteor: (p) => `
        <ellipse cx="25.5" cy="32" rx="11.5" ry="3.8" stroke="url(#${p}f)" stroke-width="1.6" fill="none"/>
        <path d="M5 5C14 7 23 12 29.5 19.5L19.5 29.5C12 23 7 14 5 5Z" fill="url(#${p}r)"/>
        <path d="M8.5 8.5C15.5 10.5 22 14.5 27 20.5L20.5 27C14.5 22 10.5 15.5 8.5 8.5Z" fill="url(#${p}f)"/>
        <circle cx="25" cy="25" r="7.5" fill="#4a1714" stroke="url(#${p}f)" stroke-width="1.5"/>
        <path d="M21 22.5L25 25L28.5 22M24.5 25L23.5 30M25 25L29.5 27.5" stroke="#fff7c2" stroke-width="1.5" stroke-linecap="round"/>`,

    // --- TACTICAL & SUPPORT COMMANDS ---
    cmd_guard: (p) => `
        <path d="M20 5L32 9.5V19.5C32 27.5 26.8 33.2 20 36C13.2 33.2 8 27.5 8 19.5V9.5L20 5Z" fill="url(#${p}s)" stroke="url(#${p}g)" stroke-width="2.1"/>
        <path d="M20 6.5V34.2C14.2 31.6 9.8 26.5 9.8 19.5V10.6L20 6.5Z" fill="#dce6f0" opacity="0.45"/>
        <path d="M20 8V33M11 18.5H29" stroke="url(#${p}g)" stroke-width="1.8"/>
        <polygon points="20 14.2 23.5 18.5 20 22.8 16.5 18.5" fill="#fff5d4" stroke="#261a10" stroke-width="0.8"/>`,

    cmd_shift: (p) => `
        <path d="M8.5 17.5C9.5 10.5 15.5 6.5 23 7.5L21.5 4.5L29.5 9.5L21.5 14L23 11C17.2 10.2 13 13 12 18Z" fill="url(#${p}c)"/>
        <path d="M31.5 22.5C30.5 29.5 24.5 33.5 17 32.5L18.5 35.5L10.5 30.5L18.5 26L17 29C22.8 29.8 27 27 28 22Z" fill="url(#${p}g)"/>
        <polygon points="20 14.5 25.5 20 20 25.5 14.5 20" fill="url(#${p}g)" stroke="#1b130d" stroke-width="0.95"/>
        <circle cx="20" cy="20" r="2" fill="#ffffff"/>`,

    cmd_potion: (p) => `
        <rect x="17" y="5" width="6" height="4" rx="1" fill="#9c6b3e" stroke="#1e140c" stroke-width="0.85"/>
        <path d="M15.5 9.5H24.5M17 9.5V13.5L10.5 22.5C8.5 25.5 9.8 34 20 34C30.2 34 31.5 25.5 29.5 22.5L23 13.5V9.5" fill="#1e242e" fill-opacity="0.55" stroke="url(#${p}s)" stroke-width="1.6"/>
        <path d="M11.6 23.5C14.5 22 17.5 24.8 20.5 23.5C23.5 22.2 26.2 23.8 28.4 23.2C29.8 26.8 28.4 32.5 20 32.5C11.6 32.5 10.2 26.8 11.6 23.5Z" fill="url(#${p}r)"/>
        <path d="M13.5 19.5C12 22.5 12.2 26.5 14.2 29" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="0.8"/>
        <circle cx="18" cy="27.5" r="1.3" fill="#ffd9dc"/>
        <circle cx="22.5" cy="25.5" r="1" fill="#ffd9dc"/>`,

    cmd_phoenix: (p) => `
        <path d="M32.5 5.5C23.5 6.5 15.5 12.5 11.5 22.5L8.5 33.5L18.5 27.5C26.5 22.5 31.8 14.5 32.5 5.5Z" fill="url(#${p}f)" stroke="#24100a" stroke-width="0.95"/>
        <path d="M30.5 8C24 9.5 18 14 14.8 21.5L13 28.2C20.5 24.5 27.5 17.5 30.5 8Z" fill="url(#${p}g)"/>
        <path d="M7.5 34.5L28.5 10.5" stroke="#fff9d6" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="11" cy="14" r="1.4" fill="#ffe89e"/>
        <circle cx="29" cy="27" r="1.5" fill="#ff9e44"/>`,

    cmd_retreat: (p) => `
        <path d="M16 9L24.5 10.5L23 22.5L32.5 27.5C34 28.5 33.8 31.5 31.5 31.8H13.5V24.5L16 9Z" fill="url(#${p}g)" stroke="#1c140d" stroke-width="1"/>
        <path d="M16.5 13C11.5 11.5 8.5 8.5 9 5.5C12.5 6.5 15.5 8.8 17 11.5Z" fill="#fff2cc"/>
        <line x1="4.5" y1="19" x2="12" y2="19" stroke="url(#${p}c)" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="3.5" y1="24" x2="10.5" y2="24" stroke="url(#${p}c)" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="6" y1="29" x2="11.5" y2="29" stroke="#d8e3ee" stroke-width="1.4" stroke-linecap="round"/>`
};

function combatSkillSvg(key, size = 32, standalone = false) {
    const validKey = COMBAT_SKILL_SVG_BODIES[key] ? key : 'atk_sword';
    const prefix = standalone ? `edk_${validKey}_` : `edg${++_edCombatSvgSeq}_`;
    const xmlns = standalone ? ' xmlns="http://www.w3.org/2000/svg"' : '';
    const defs = _buildCombatSvgDefs(prefix);
    const body = COMBAT_SKILL_SVG_BODIES[validKey](prefix);
    return `<svg${xmlns} class="svg-ico combat-skill-svg" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">${defs}${body}</svg>`;
}

function getHeroCombatIconSet(hero) {
    if (!hero || hero.isEnemy) {
        return {
            attack: 'atk_sword',
            skill: 'skill_default',
            skill2: 'skill_mastery_default',
            ult: 'ult_default'
        };
    }
    if (hero.role === 'Warrior') {
        return { attack: 'atk_sword', skill: 'skill_shield_bash', skill2: 'skill_whirlwind', ult: 'ult_bastion' };
    }
    if (hero.role === 'Ranger') {
        return { attack: 'atk_bow', skill: 'skill_armor_piercer', skill2: 'skill_viper_volley', ult: 'ult_arrow_rain' };
    }
    if (hero.role === 'Cleric') {
        return { attack: 'atk_mace', skill: 'skill_holy_purify', skill2: 'skill_divine_aegis', ult: 'ult_miracle' };
    }
    return { attack: 'atk_staff', skill: 'skill_hellfire', skill2: 'skill_frost_nova', ult: 'ult_meteor' };
}

function resolveCombatPopupSvgKey(rawText, color = '') {
    const s = String(rawText || '');
    if (!s) return null;
    if (/METEOR|\u2604/i.test(s)) return 'ult_meteor';
    if (/VIPER|\u{1F40D}/u.test(s)) return 'skill_viper_volley';
    if (/WHIRLWIND|KNOCKBACK|\u{1F32A}/u.test(s)) return 'skill_whirlwind';
    if (/AEGIS|STUN IMMUNE/i.test(s)) return 'skill_divine_aegis';
    if (/SHATTER|STUN|SKIP|\u2744/i.test(s)) return 'skill_frost_nova';
    if (/THERMAL|BURN|PHASE 2|\u{1F525}/u.test(s)) return 'skill_hellfire';
    if (/TOXIC|SPASM|POISON|\u2620|\u{1F922}/u.test(s)) return 'skill_viper_volley';
    if (/REVIVE|\u{1FAB6}/u.test(s)) return 'cmd_phoenix';
    if (/\+\d+\s*HP|RESTORED|SANCTIFIED|BLESSED/i.test(s)) return 'skill_holy_purify';
    if (/GUARD|\u{1F6E1}/u.test(s)) return 'cmd_guard';
    if (/\u{1F3F9}/u.test(s)) return 'atk_bow';
    if (/CRIT|AMBUSH|REINFORCE|ULTIMATE|BASTION|MIRACLE|ARROWS|\u{1F4A5}|\u2694/u.test(s)) return 'ult_default';
    if (/^-\d+/.test(s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim())) return 'atk_sword';
    return null;
}

function resolveChronicleCombatSvgKey(rawMsg) {
    const s = String(rawMsg || '');
    if (/METEOR APOCALYPSE/i.test(s)) return 'ult_meteor';
    if (/RAIN OF ARROWS/i.test(s)) return 'ult_arrow_rain';
    if (/IMMORTAL BASTION/i.test(s)) return 'ult_bastion';
    if (/DIVINE MIRACLE/i.test(s)) return 'ult_miracle';
    if (/ULTIMATE/i.test(s)) return 'ult_default';
    if (/Shield Bash/i.test(s)) return 'skill_shield_bash';
    if (/Armor Piercer/i.test(s)) return 'skill_armor_piercer';
    if (/Holy Purify/i.test(s)) return 'skill_holy_purify';
    if (/Hellfire Blast|\[BURN\]|Thermal Shock/i.test(s)) return 'skill_hellfire';
    if (/Whirlwind Cleave/i.test(s)) return 'skill_whirlwind';
    if (/Viper Volley|\[POISON\]|Toxic/i.test(s)) return 'skill_viper_volley';
    if (/Divine Aegis/i.test(s)) return 'skill_divine_aegis';
    if (/Frost Nova|\[STUNNED\]|Shatter/i.test(s)) return 'skill_frost_nova';
    if (/Raise Guard|GUARD/i.test(s)) return 'cmd_guard';
    if (/REPOSITION/i.test(s)) return 'cmd_shift';
    if (/Phoenix/i.test(s)) return 'cmd_phoenix';
    if (/Strike|menyerang|menghantam|COMBAT DIMULAI|COUNTER/i.test(s)) return 'atk_sword';
    return null;
}

function getCombatSvgCanvasImage(key) {
    if (!key || typeof Image === 'undefined') return null;
    if (_edCanvasSvgImgCache[key]) return _edCanvasSvgImgCache[key];
    const svgMarkup = combatSkillSvg(key, 40, true);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
    _edCanvasSvgImgCache[key] = img;
    return img;
}
