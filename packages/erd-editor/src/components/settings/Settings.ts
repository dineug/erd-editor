import { delay } from '@dineug/go';
import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Button from '@/components/primitives/button/Button';
import Icon from '@/components/primitives/icon/Icon';
import Separator from '@/components/primitives/separator/Separator';
import Switch from '@/components/primitives/switch/Switch';
import Toast from '@/components/primitives/toast/Toast';
import {
  changeColumnOrderAction,
  changeRelationshipDataTypeSyncAction,
} from '@/engine/modules/settings/atom.actions';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';
import { openToastAction } from '@/utils/emitter';
import { FlipAnimation } from '@/utils/flipAnimation';
import { fromDraggable } from '@/utils/rx-operators/fromDraggable';

import * as styles from './Settings.styles';

export type SettingsProps = {};

const Settings: FC<SettingsProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleChangeRelationshipDataTypeSync = (value: boolean) => {
    const { store } = app.value;
    store.dispatch(changeRelationshipDataTypeSyncAction({ value }));
  };

  const handleRecalculationTableWidth = () => {
    const { store, emitter, toWidth } = app.value;
    recalculateTableWidth(store.state, { toWidth });
    relationshipSort(store.state);
    emitter.emit(
      openToastAction({
        close: delay(2000),
        message: html`<${Toast} title="Recalculated table width" />`,
      })
    );
  };

  return () => {
    const { store } = app.value;
    const { settings } = store.state;

    return html`
      <div class=${styles.root}>
        <div class=${styles.title}>Settings</div>
        <${Separator} space=${24} />
        <div class=${['scrollbar', styles.content]}>
          <div class=${styles.section}>
            <div class=${styles.row}>
              <div>Relationship DataType Sync</div>
              <div class=${styles.vertical(16)}></div>
              <${Switch}
                value=${settings.relationshipDataTypeSync}
                .onChange=${handleChangeRelationshipDataTypeSync}
              />
            </div>
            <div class=${styles.row}>
              <div>Recalculation table width</div>
              <div class=${styles.vertical(16)}></div>
              <${Button}
                variant="soft"
                size="1"
                text=${html`
                  <${Icon} size=${14} name="rotate" />
                  <div class=${styles.vertical(8)}></div>
                  <span>Sync</span>
                `}
                .onClick=${handleRecalculationTableWidth}
              />
            </div>
          </div>
        </div>
      </div>
    `;
  };
};

export default Settings;
