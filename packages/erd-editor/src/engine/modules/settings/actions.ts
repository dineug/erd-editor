import { Reducer } from '@dineug/r-html';

import { DDLScriptPosition, NameViewMode } from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  changeDatabaseName: 'settings.changeDatabaseName',
  changeZoomLevel: 'settings.changeZoomLevel',
  streamZoomLevel: 'settings.streamZoomLevel',
  scrollTo: 'settings.scrollTo',
  streamScrollTo: 'settings.streamScrollTo',
  changeShow: 'settings.changeShow',
  changeDatabase: 'settings.changeDatabase',
  changeCanvasType: 'settings.changeCanvasType',
  changeLanguage: 'settings.changeLanguage',
  changeTableNameCase: 'settings.changeTableNameCase',
  changeColumnNameCase: 'settings.changeColumnNameCase',
  changeBracketType: 'settings.changeBracketType',
  changeRelationshipDataTypeSync: 'settings.changeRelationshipDataTypeSync',
  changeColumnOrder: 'settings.changeColumnOrder',
  changeMaxWidthComment: 'settings.changeMaxWidthComment',
  changeLockSettings: 'settings.changeLockSettings',
  changeIgnoreSaveSettings: 'settings.changeIgnoreSaveSettings',
  changeDDLScript: 'settings.changeDDLScript',
  changeNameViewMode: 'settings.changeNameViewMode',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

/** What a code setter carries: its value, and whether every peer takes it. */
export type CodeSettingPayload = {
  value: number;
  /**
   * Set by the shared store on what it sends, made while the lock was off, so
   * every peer writes it through the register whatever its own lock says.
   */
  shared?: boolean;
};

export type ActionMap = {
  [ActionType.changeDatabaseName]: {
    value: string;
  };
  [ActionType.changeZoomLevel]: {
    value: number;
  };
  [ActionType.streamZoomLevel]: {
    value: number;
  };
  [ActionType.scrollTo]: {
    originX: number;
    originY: number;
  };
  [ActionType.streamScrollTo]: {
    movementX: number;
    movementY: number;
  };
  [ActionType.changeShow]: {
    show: number;
    value: boolean;
  };
  [ActionType.changeDatabase]: {
    value: number;
  };
  [ActionType.changeCanvasType]: {
    value: string;
  };
  [ActionType.changeLanguage]: CodeSettingPayload;
  [ActionType.changeTableNameCase]: CodeSettingPayload;
  [ActionType.changeColumnNameCase]: CodeSettingPayload;
  [ActionType.changeBracketType]: CodeSettingPayload;
  [ActionType.changeRelationshipDataTypeSync]: {
    value: boolean;
  };
  [ActionType.changeColumnOrder]: {
    value: number;
    target: number;
  };
  [ActionType.changeMaxWidthComment]: {
    value: number;
  };
  [ActionType.changeLockSettings]: {
    lockSettingType: number;
    value: boolean;
    /**
     * The settings named as the sending store shows them: a lock holds them,
     * and an unlock shows the code settings and the name view among them on
     * every peer, so each saves one value. The viewport and the tab carry none.
     */
    values: Partial<RootState['settings']['lockedValues']>;
  };
  [ActionType.changeIgnoreSaveSettings]: {
    saveSettingType: number;
    value: boolean;
  };
  [ActionType.changeDDLScript]: {
    position: ValuesType<typeof DDLScriptPosition>;
    value: string;
  };
  [ActionType.changeNameViewMode]: {
    value: ValuesType<typeof NameViewMode>;
    /**
     * Whether every peer takes it: the sender's lock was off and it could
     * edit. Otherwise only the store whose editor sent it shows it.
     */
    shared: boolean;
    editorId: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
