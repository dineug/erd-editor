import { uuid25 } from '@dineug/uuid';

import { DeepPartial, Domain } from '@/internal-types';
import { deepMerge } from '@/utils/deepMerge';

export const createDomain = (value?: DeepPartial<Domain>): Domain =>
  deepMerge<Domain>(
    {
      id: uuid25(),
      name: '',
      category: '',
      dataType: '',
      description: '',
    },
    value ?? {}
  );
