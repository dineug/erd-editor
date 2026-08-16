import { FC } from '@dineug/r-html';

import * as styles from './Switch.styles';

export type SwitchProps = {
  size?: '1' | '2' | '3';
  value: boolean;
  onChange: (value: boolean) => void;
};

const Switch: FC<SwitchProps> = (props, ctx) => {
  const handleChange = () => {
    props.onChange(!props.value);
  };

  return () => (
    <button
      class={[
        styles.switchButton,
        Reflect.get(styles, `size${props.size ?? '2'}`),
      ]}
      type="button"
      data-checked={props.value}
      on:click={handleChange}
    >
      <span class={styles.switchThumb} bool:data-checked={props.value}></span>
    </button>
  );
};

export default Switch;
