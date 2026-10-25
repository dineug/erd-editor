import './erd-editor';
import './erd-viewer';

// @ts-ignore
import Stats from 'stats.js';

function runStats() {
  const stats = new Stats();
  stats.dom.style.top = '';
  stats.dom.style.left = '';
  stats.dom.style.bottom = '20px';
  stats.dom.style.right = '20px';
  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.style.display = 'flex';
  document.body.appendChild(stats.dom);

  const animate = () => {
    stats.begin();
    stats.end();
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

/** Each element takes half the width of the page and all of its height. */
const HALF = 'display: block; flex: 1 1 0; min-width: 0; height: 100%;';

function runEditor() {
  const editor = document.createElement('erd-editor');
  editor.enableThemeBuilder = true;
  editor.enableLocalePicker = true;
  editor.enableWelcomeScreen = true;
  editor.setAttribute('style', HALF);
  document.body.appendChild(editor);

  return editor;
}

/** A viewer beside the editor, which draws the editor's document each time the editor reports a change. */
function runViewer(editor: HTMLElementTagNameMap['erd-editor']) {
  const viewer = document.createElement('erd-viewer');
  viewer.setAttribute('style', HALF);
  viewer.value = editor.value;
  editor.addEventListener('change', () => {
    viewer.value = editor.value;
  });
  document.body.appendChild(viewer);

  return viewer;
}

runStats();

const editor1 = runEditor();
runViewer(editor1);
// const editor2 = runEditor();

// const sharedStore1 = editor1.getSharedStore();
// const sharedStore2 = editor2.getSharedStore();

// sharedStore1.subscribe(actions => sharedStore2.dispatch(actions));
// sharedStore2.subscribe(actions => sharedStore1.dispatch(actions));
