const scrollbar = /* css */ `
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}
::-webkit-scrollbar-corner {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.scrollbar {
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
}
`;

export function createScrollbarStyle() {
  const style = document.createElement('style');
  style.textContent = scrollbar;
  return style;
}
