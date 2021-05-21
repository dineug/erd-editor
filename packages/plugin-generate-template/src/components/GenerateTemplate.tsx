import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { useContext } from '@/core/hooks/useContext';

const GenerateTemplate: FunctionalComponent = () => {
  const [ctxRef, ctx] = useContext();

  useEffect(() => {
    console.log(ctx.api);
  });

  return <div ref={ctxRef}>test</div>;
};

export default GenerateTemplate;
