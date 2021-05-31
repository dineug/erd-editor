import { FunctionalComponent } from 'preact';
import styled from 'styled-components';
import { getIcon } from '@/core/icon';

type Cursor = 'default' | 'pointer';

interface Props {
  prefix: string;
  name: string;
  size: number;
  color: string | null;
  transition: boolean;
  cursor: Cursor;
}

const Container = styled.div<{ cursor: Cursor }>`
  height: 100%;
  display: inline-flex;
  align-items: center;
  fill: var(--vuerd-color-font);
  cursor: ${props => props.cursor};
  &:hover {
    fill: var(--vuerd-color-font-active);
  }
`;

const Canvas = styled.svg<{ transition: boolean }>`
  ${props => (props.transition ? `transition: fill 0.15s;` : null)}
`;

const SIZE = 24;
const SIZE_REM = 1.5;

const Icon: FunctionalComponent<Partial<Props>> = ({
  prefix = 'mdi',
  name = '',
  size = SIZE,
  color = null,
  transition = true,
  cursor = 'default',
}) => {
  const icon = getIcon(prefix, name);
  if (!icon) return null;

  const [width, height, , , d] = icon.icon;
  const rem = SIZE_REM * (size / SIZE);

  return (
    <Container cursor={cursor}>
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
