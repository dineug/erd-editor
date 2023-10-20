/**
 * Last write wins
 * @value timestamp
 * @example
 * ```json
 * {
 *   "op[add].path[tableEntities].id[uuid]": 1697823339875,
 *   "op[remove].path[tableEntities].id[uuid]": 1697823339875,
 *   "op[replace].path[tableEntities.ui.x].id[uuid]": 1697823339875
 * }
 * ```
 */
export type LWW = Record<string, number>;
