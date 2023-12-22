export class GridTextRender {
  el: HTMLDivElement;

  constructor(props: any) {
    this.el = document.createElement('div');
    this.el.classList.add('vuerd-grid-text');
    this.render(props);
  }

  getElement() {
    return this.el;
  }
  render(props: any) {
    this.el.innerText = this.getValue(props);
  }

  getValue(props: any) {
    const { placeholder } = props.columnInfo.renderer.options as any;
    const value = String(props.value);
    if (value.trim() === '') {
      this.el.classList.add('placeholder');
      return placeholder;
    } else {
      this.el.classList.remove('placeholder');
      return value;
    }
  }
}
