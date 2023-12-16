const reset = /* css */ `
p,
ol,
ul,
li,
dl,
dt,
dd,
blockquote,
figure,
fieldset,
legend,
textarea,
pre,
iframe,
hr,
h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0;
  padding: 0;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: 100%;
  font-weight: normal;
}

ul {
  list-style: none;
}

button,
input,
select,
textarea {
  padding: 0;
  border: none;
  outline: none;
  font-family: var(--text-font-family);
  color: var(--active);
  background-color: inherit;
}

input::placeholder,
textarea::placeholder {
  font-family: var(--text-font-family);
  color: var(--placeholder);
  opacity: 1;
}

input:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

*, *::before, *::after {
  box-sizing: border-box;
}

img,
video {
  height: auto;
  max-width: 100%;
}

iframe {
  border: 0;
}

table {
  border-collapse: collapse;
  border-spacing: 0;
}

td,
th {
  padding: 0;
}

:host {
  font-family: var(--text-font-family);
  color: var(--foreground);
  fill: var(--foreground);
  font-size: var(--font-size-2);
  letter-spacing: var(--letter-spacing-2);
  line-height: var(--line-height-2);
  font-weight: var(--font-weight-regular);
}
`;

export function createResetStyle() {
  const style = document.createElement('style');
  style.textContent = reset;
  return style;
}
