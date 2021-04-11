import { TippyStyle } from '@/components/css/tippy.style';
import { ERDEditorStyle } from './ERDEditor.style';
import { SettingDrawerStyle } from './drawer/SettingDrawer.style';
import { TablePropertiesDrawerStyle } from './drawer/tablePropertiesDrawer/TablePropertiesDrawer.style';

export const IndexStyle = [
  TippyStyle,
  ERDEditorStyle,
  TablePropertiesDrawerStyle,
  SettingDrawerStyle,
].join('');
