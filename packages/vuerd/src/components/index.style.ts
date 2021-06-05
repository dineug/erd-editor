import { TippyStyle } from '@/components/css/tippy.style';

import { SettingDrawerStyle } from './drawer/SettingDrawer.style';
import { TablePropertiesDrawerStyle } from './drawer/tablePropertiesDrawer/TablePropertiesDrawer.style';
import { ERDEditorStyle } from './ERDEditor.style';
import { IconStyle } from './Icon.style';

export const IndexStyle = [
  TippyStyle,
  ERDEditorStyle,
  TablePropertiesDrawerStyle,
  SettingDrawerStyle,
  IconStyle,
].join('');
