import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

import Icon from '@/components/Icon';
import Sash from '@/components/Sash';
import { Container, Tab, TabGroup } from '@/components/sidebar/Sidebar.styled';
import { SIDEBAR_WIDTH } from '@/core/layout';
import { useContext } from '@/hooks/useContext';
import { useGrid } from '@/hooks/useGrid';
import { useTooltip } from '@/hooks/useTooltip';
import { Move } from '@/internal-types/event.helper';

type TabType = 'Templates' | 'DataTypes';

export interface Props {
  width: number;
  onGlobalMove(move: Move): void;
  onMousedown(event: React.MouseEvent): void;
}

const Grid = () => {
  const [parentRef] = useGrid();
  return <div ref={parentRef} />;
};

const Sidebar: FunctionalComponent<Partial<Props>> = ({
  width = SIDEBAR_WIDTH,
  onGlobalMove,
  onMousedown,
}) => {
  const [tabName, setTab] = useState<TabType>('Templates');
  const [tooltipRef] = useTooltip(2);
  const { stores } = useContext();

  const isTab = (target: TabType) => tabName === target;

  return (
    <Container style={{ width: `${width}px` }}>
      <TabGroup>
        <Tab active={isTab('Templates')} onClick={() => setTab('Templates')}>
          <div
            class="tooltip"
            data-tippy-content="Templates"
            ref={tooltipRef.current[0]}
          >
            <Icon
              active={isTab('Templates')}
              name="view-list"
              cursor="pointer"
              size={20}
              transition={false}
            />
          </div>
        </Tab>
        <Tab active={isTab('DataTypes')} onClick={() => setTab('DataTypes')}>
          <div
            class="tooltip"
            data-tippy-content="DataTypes"
            ref={tooltipRef.current[1]}
          >
            <Icon
              active={isTab('DataTypes')}
              name="table"
              cursor="pointer"
              size={20}
              transition={false}
            />
          </div>
        </Tab>
      </TabGroup>
      <Sash
        vertical
        left={width}
        onGlobalMove={onGlobalMove}
        onMousedown={onMousedown}
      />
      {isTab('Templates') ? <></> : <Grid />}
    </Container>
  );
};

export default observer(Sidebar);
