import {Column} from '@/store/table';

interface List {
  name: string;
}

export function formatNames<T extends List>(list: T[], backtick?: string, backtick2?: string): string {
  const buf: string[] = [];
  list.forEach((v, i) => {
    if (backtick) {
      if (backtick2) {
        buf.push(`${backtick}${v.name}${backtick2}`);
      } else {
        buf.push(`${backtick}${v.name}${backtick}`);
      }
    } else {
      buf.push(v.name);
    }
    if (list.length !== i + 1) {
      buf.push(', ');
    }
  });
  return buf.join('');
}

export function formatSize(columns: Column[]): {nameMax: number, dataTypeMax: number} {
  let nameMax = 0;
  let dataTypeMax = 0;
  columns.forEach((column: Column) => {
    if (nameMax < column.name.length) {
      nameMax = column.name.length;
    }
    if (dataTypeMax < column.dataType.length) {
      dataTypeMax = column.dataType.length;
    }
  });
  return {
    nameMax,
    dataTypeMax,
  };
}

export function formatSpace(size: number): string {
  const buf: string[] = [];
  for (let i = 0; i < size; i++) {
    buf.push(' ');
  }
  return buf.join('');
}
