import { FunctionalComponent } from 'preact';

import { useTooltip } from '@/hooks/useTooltip';

interface Props {
  content: string;
}

const Tippy: FunctionalComponent<Partial<Props>> = ({
  content = '',
  children,
}) => {
  const [tooltipRef] = useTooltip(1);

  return (
    <div
      class="tooltip"
      data-tippy-content={content}
      ref={tooltipRef.current[0]}
    >
      {children}
    </div>
  );
};

export default Tippy;
