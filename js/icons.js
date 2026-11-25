// ============================================================================
// BESPOKE DARK-FANTASY SVG ICONOGRAPHY SYSTEM
// Replaces all OS emojis with crisp chiseled vector sigils using currentColor.
// ============================================================================

const DUNGEON_SVG_PATHS = {
    crest: '<path d="M12 2L14.8 8.2L21 9.5L16 14L17.5 21L12 17.4L6.5 21L8 14L3 9.5L9.2 8.2L12 2Z"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
    torch: '<path d="M12 2C14.5 5 16.5 7.2 16.5 10C16.5 12.5 14.5 14.2 12 14.2C9.5 14.2 7.5 12.5 7.5 10C7.5 7.8 9 6 10.2 4.5C10.2 6.5 11.5 7.2 12 5.5C12.3 4.3 12 3 12 2Z"/><path d="M9 14.5H15L13.6 22H10.4L9 14.5Z"/><path d="M7.5 14.5H16.5"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 6.8V17.2M6.8 12H17.2"/>',
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
    sword: '<path d="M19.5 4.5L9.5 14.5M15 4.5H19.5V9M6.5 11.5L12.5 17.5M4.5 19.5L8 16"/>',
    arcane: '<path d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6L12 2.5Z"/>',
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
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
