import { FunctionalComponent } from 'preact';

import { Canvas, Container } from '@/components/Icon.styled';
import { getIcon } from '@/core/icon';

export type Cursor = 'default' | 'pointer';

export interface Props {
  prefix: string;
  name: string;
  size: number;
  color: string | null;
  transition: boolean;
  cursor: Cursor;
  active: boolean;
  onClick(event: React.MouseEvent): void;
}

const SIZE = 24;
const SIZE_REM = 1.5;

const Icon: FunctionalComponent<Partial<Props>> = ({
  prefix = 'mdi',
  name = '',
  size = SIZE,
  color = null,
  transition = true,
  cursor = 'default',
  active = false,
  onClick,
}) => {
  const icon = getIcon(prefix, name);
  if (!icon) return null;

  const [width, height, , , d] = icon.icon;
  const rem = SIZE_REM * (size / SIZE);

  return (
    <Container cursor={cursor} active={active} onClick={onClick}>
      <Canvas
        style={{
          width: `${rem}rem`,
          height: `${rem}rem`,
        }}
        transition={transition}
        viewBox={`0 0 ${width} ${height}`}
      >
        {color ? <path d={d} fill={color}></path> : <path d={d}></path>}
      </Canvas>
    </Container>
  );
};

export default Icon;
