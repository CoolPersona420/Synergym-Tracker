/* The colour themes, as data (no browser needed, so scripts/icons.mjs can read them too). Auto follows the
   system (mono light or mono dark); the rest are named palettes. c: the picker's swatch, in order the page
   background, a surface, text, the accent and a block of colour. */
export const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Mono, follows your device', dark: null, c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#050505'] },
  { id: 'light', name: 'Mono Light', note: 'Black on white', dark: false, pair: 'dark', c: ['#EDEDED', '#FFFFFF', '#0E0E0E', '#0E0E0E', '#0E0E0E'] },
  { id: 'dark', name: 'Mono Dark', note: 'White on black', dark: true, pair: 'light', c: ['#050505', '#151515', '#F4F4F4', '#F4F4F4', '#1F1F1F'] },
  { id: 'solarized-light', name: 'Solarized Light', note: 'Warm paper, blue ink', dark: false, pair: 'solarized-dark', c: ['#FDF6E3', '#FFFCF2', '#073642', '#268BD2', '#073642'] },
  { id: 'solarized-dark', name: 'Solarized Dark', note: 'Deep teal, cool text', dark: true, pair: 'solarized-light', c: ['#002B36', '#073642', '#EEE8D5', '#268BD2', '#073642'] },
  { id: 'gruvbox-light', name: 'Gruvbox Light', note: 'Retro cream and rust', dark: false, pair: 'gruvbox-dark', c: ['#FBF1C7', '#F9F5D7', '#3C3836', '#AF3A03', '#3C3836'] },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', note: 'Retro charcoal and amber', dark: true, pair: 'gruvbox-light', c: ['#282828', '#32302F', '#EBDBB2', '#FABD2F', '#1D2021'] },
  { id: 'nord', name: 'Nord', note: 'Arctic blue-grey', dark: true, pair: 'light', c: ['#2E3440', '#3B4252', '#ECEFF4', '#88C0D0', '#3B4252'] },
  { id: 'dracula', name: 'Dracula', note: 'Night with violet', dark: true, pair: 'light', c: ['#282A36', '#303341', '#F8F8F2', '#BD93F9', '#21222C'] },
  { id: 'ocean', name: 'Ocean', note: 'The deep blue original', dark: true, pair: 'light', c: ['#073F6F', '#0E4C7E', '#FFFFFF', '#8CDDF2', '#0A5690'] },
  { id: 'sage', name: 'Sage', note: 'Olive with terracotta', dark: false, pair: 'volt', c: ['#C3C6B1', '#CED1BD', '#1F241D', '#C9583A', '#DE6F4E'] },
  { id: 'volt', name: 'Volt', note: 'Black with electric lime', dark: true, pair: 'sage', c: ['#0A0A0A', '#161616', '#F2F2F2', '#D4F25A', '#161616'] }
];
