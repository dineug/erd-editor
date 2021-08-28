import { Template } from '@/core/indexedDB';

export const templates: Array<Pick<Template, 'name' | 'value'>> = [
  {
    name: 'test',
    value: `
[DATA].reduce((buffer, data) => {
  const state = data.state;
  const helper = data.helper;

  buffer.push('test');
  buffer.push(helper.snakeCase('testTest'));

  return buffer;
}, []).join('\\n');
    `,
  },
];
