import { FunctionalComponent } from 'preact';
import { useContext } from '@/core/hooks/useContext';
import styled from 'styled-components';

const Button = styled.button`
  color: red;
`;

const GenerateTemplate: FunctionalComponent = () => {
  const context = useContext();

  console.log(context);

  return <Button>test</Button>;
};

export default GenerateTemplate;
