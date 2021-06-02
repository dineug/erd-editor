import { FunctionalComponent } from 'preact';
import Icon from '@/components/Icon';
import { Container } from '@/components/editor/Toolbar.styled';

interface Props {}

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
