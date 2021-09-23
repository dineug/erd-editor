import TWEEN from '@tweenjs/tween.js';

function animate(time?: number) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}

requestAnimationFrame(animate);
