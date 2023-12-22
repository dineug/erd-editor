import { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';

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
  const [data, setData] = useState({ width: 0, height: 0, d: '' });
  const [rem, setRem] = useState(SIZE_REM * (size / SIZE));

  useEffect(() => {
    setRem(SIZE_REM * (size / SIZE));
  }, [size]);

  useEffect(() => {
    const icon = getIcon(prefix, name);
    if (icon) {
      const [width, height, , , d] = icon.icon;
      setData({
        width,
        height,
        d,
      });
    } else {
      setData({
        width: 0,
        height: 0,
        d: '',
      });
    }
  }, [prefix, name]);

  return data.d ? (
    <Container cursor={cursor} active={active} onClick={onClick}>
      <Canvas
        style={{
          width: `${rem}rem`,
          height: `${rem}rem`,
        }}
        transition={transition}
        viewBox={`0 0 ${data.width} ${data.height}`}
      >
        {color ? (
          <path d={data.d} fill={color}></path>
        ) : (
          <path d={data.d}></path>
        )}
      </Canvas>
    </Container>
  ) : null;
};

export default Icon;
