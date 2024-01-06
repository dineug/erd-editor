const LAZY_KEY = Symbol.for('vuerd');
const { extension } = Reflect.get(globalThis, LAZY_KEY);
