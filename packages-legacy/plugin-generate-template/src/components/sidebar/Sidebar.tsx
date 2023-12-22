import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import Icon from '@/components/Icon';
import Sash from '@/components/Sash';
import {
  Action,
  Container,
  Tab,
  TabGroup,
} from '@/components/sidebar/Sidebar.styled';
import { Template } from '@/core/indexedDB';
import { SIDEBAR_WIDTH } from '@/core/layout';
import { useContext } from '@/hooks/useContext';
import { useDataTypeGrid } from '@/hooks/useDataTypeGrid';
import { useTemplateGrid } from '@/hooks/useTemplateGrid';
import { useTooltip } from '@/hooks/useTooltip';
import { Move } from '@/internal-types/event.helper';

type TabType = 'Templates' | 'DataTypes';

export interface Props {
  width: number;
  onGlobalMove(move: Move): void;
  onMousedown(event: React.MouseEvent): void;
  onChangeTemplate(uuid: string): void;
}

const Sidebar: FunctionalComponent<Partial<Props>> = ({
  width = SIDEBAR_WIDTH,
  onGlobalMove,
  onMousedown,
  onChangeTemplate,
}) => {
  const [tabName, setTab] = useState<TabType>('Templates');
  const [tooltipRef, resetTooltip] = useTooltip(4);
  const { stores } = useContext();
  const [dataTypeParentRef, dataTypeGridRef] = useDataTypeGrid(width);
  const [templateParentRef, templateGridRef] = useTemplateGrid(width);

  const isTab = (target: TabType) => tabName === target;

  const addGridColumn = () => {
    if (isTab('Templates')) {
      if (!templateGridRef.current) return;
      stores.template.create({
        name: '',
        value: '',
      });
    } else {
      if (!dataTypeGridRef.current) return;
      stores.dataType.create({
        name: '',
        primitiveType: '',
      });
    }
  };

  const removeGridColumn = () => {
    if (isTab('Templates')) {
      if (!templateGridRef.current) return;
      templateGridRef.current
        .getCheckedRows()
        .forEach(({ uuid }: any) => stores.template.delete(uuid));
    } else {
      if (!dataTypeGridRef.current) return;
      dataTypeGridRef.current
        .getCheckedRows()
        .forEach(({ uuid }: any) => stores.dataType.delete(uuid));
    }
  };

  const templateGridFocusChange = (event: any) => {
    if (!templateGridRef.current || !onChangeTemplate) return;
    const row = templateGridRef.current.getRow(event.rowKey) as Template | null;
    if (!row) return;
    const { uuid } = row;
    onChangeTemplate(uuid);
  };

  useEffect(() => {
    dataTypeGridRef.current?.setWidth(width);
    templateGridRef.current?.setWidth(width);
    resetTooltip();
  }, [tabName]);

  useEffect(() => {
    templateGridRef.current?.on('focusChange', templateGridFocusChange);
    return () =>
      templateGridRef.current?.off('focusChange', templateGridFocusChange);
  }, []);

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
        <Action style={{ marginLeft: 'auto' }} onClick={addGridColumn}>
          <div
            class="tooltip"
            data-tippy-content={
              isTab('Templates') ? 'Add Template' : 'Add DataType'
            }
            ref={tooltipRef.current[2]}
          >
            <Icon name="plus" cursor="pointer" size={20} />
          </div>
        </Action>
        <Action style={{ marginRight: '5px' }} onClick={removeGridColumn}>
          <div
            class="tooltip"
            data-tippy-content={
              isTab('Templates') ? 'Remove Template' : 'Remove DataType'
            }
            ref={tooltipRef.current[3]}
          >
            <Icon name="minus" cursor="pointer" size={20} />
          </div>
        </Action>
      </TabGroup>
      <Sash
        vertical
        left={width}
        onGlobalMove={onGlobalMove}
        onMousedown={onMousedown}
      />
      <div
        style={{ display: isTab('Templates') ? 'block' : 'none' }}
        ref={templateParentRef}
      />
      <div
        style={{ display: isTab('DataTypes') ? 'block' : 'none' }}
        ref={dataTypeParentRef}
      />
    </Container>
  );
};

export default observer(Sidebar);
