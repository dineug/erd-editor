import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

import Icon from '@/components/Icon';
import Sash from '@/components/Sash';
import { Container, Tab, TabGroup } from '@/components/sidebar/Sidebar.styled';
import { SIDEBAR_WIDTH } from '@/core/layout';
import { useTooltip } from '@/hooks/useTooltip';
import { Move } from '@/internal-types/event.helper';

type TabType = 'Templates' | 'DataTypeMap';

export interface Props {
  width: number;
  onGlobalMove(move: Move): void;
  onMousedown(event: React.MouseEvent): void;
}

const Sidebar: FunctionalComponent<Partial<Props>> = ({
  width = SIDEBAR_WIDTH,
  onGlobalMove,
  onMousedown,
}) => {
  const [tab, setTab] = useState<TabType>('Templates');
  const [tooltipRef] = useTooltip(2);

  const isTab = (target: TabType) => tab === target;

  return (
    <Container style={{ width: `${width}px` }}>
      <TabGroup>
        <span ref={tooltipRef.current[0]} data-tippy-content="Templates">
          <Tab active={isTab('Templates')} onClick={() => setTab('Templates')}>
            <Icon
              active={isTab('Templates')}
              name="view-list"
              cursor="pointer"
              size={20}
              transition={false}
            />
          </Tab>
        </span>
        <span ref={tooltipRef.current[1]} data-tippy-content="DataTypeMap">
          <Tab
            active={isTab('DataTypeMap')}
            onClick={() => setTab('DataTypeMap')}
          >
            <Icon
              active={isTab('DataTypeMap')}
              name="table"
              cursor="pointer"
              size={20}
              transition={false}
            />
          </Tab>
        </span>
      </TabGroup>
      <Sash
        vertical
        left={width}
        onGlobalMove={onGlobalMove}
        onMousedown={onMousedown}
      />
    </Container>
  );
};

export default Sidebar;
