export function bHas(bit: number, value: number): boolean {
  return (bit & value) === value;
}
