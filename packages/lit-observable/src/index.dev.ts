import './example';
// @ts-ignore
import Stats from 'stats.js';

function runStats() {
  const stats = new Stats();
  stats.dom.style.top = '20px';
  stats.dom.style.right = '20px';
  stats.dom.style.left = '';
  document.body.appendChild(stats.dom);

  const animate = () => {
    stats.begin();
    stats.end();
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function runTodo() {
  const myTodo = document.createElement('my-todo');
  document.body.appendChild(myTodo);
}

runStats();
runTodo();
