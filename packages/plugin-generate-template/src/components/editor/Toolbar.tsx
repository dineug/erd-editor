import { FunctionalComponent } from 'preact';
import styled from 'styled-components';
import Icon from '@/components/Icon';

interface Props {}

const Container = styled.div`
  width: 100%;
  height: 30px;
  overflow: hidden;
  background-color: var(--vuerd-color-contextmenu);
`;

const Toolbar: FunctionalComponent<Props> = () => {
  return (
    <Container>
      <Icon name="file-code" size={20} />
      <Icon name="file-find" size={20} />
      <Icon name="view-split-vertical" size={20} />
    </Container>
  );
};

export default Toolbar;
