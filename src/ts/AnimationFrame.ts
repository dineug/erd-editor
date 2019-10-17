import TWEEN from '@tweenjs/tween.js'

function animate () {
  if (TWEEN.update()) {
    requestAnimationFrame(animate)
  }
}

export default class AnimationFrame<T> {
  private tween!: any

  constructor (from: T, to: T, millisecond: number) {
    this.tween = new TWEEN.Tween(from)
      .to(to, millisecond)
      .easing(TWEEN.Easing.Quadratic.Out)
  }

  public start (): AnimationFrame<T> {
    this.tween.start()
    animate()
    return this
  }

  public stop (): AnimationFrame<T> {
    this.tween.stop()
    return this
  }

  public update (callback: (value: T) => void): AnimationFrame<T> {
    this.tween.onUpdate(callback)
    return this
  }

  public complete (callback: () => void): AnimationFrame<T> {
    this.tween.onComplete(callback)
    return this
  }
}
