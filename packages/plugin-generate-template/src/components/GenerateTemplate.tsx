import { FunctionalComponent } from 'preact';
import { useContext } from '@/core/hooks/useContext';

const GenerateTemplate: FunctionalComponent = () => {
  const context = useContext();

  console.log(context);

  return <div>test</div>;
};

export default GenerateTemplate;
