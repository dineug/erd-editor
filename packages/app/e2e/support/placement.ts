import { expect } from '@playwright/test';

/**
 * A fan, one parent and two children: Flow stands the children in one layer
 * right of the parent, where the grid lays all three out in one row, so the
 * two cannot be mistaken for each other.
 */
export const FAN_SQL = `CREATE TABLE users (id INT NOT NULL, PRIMARY KEY (id));
CREATE TABLE posts (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE TABLE photos (
  id INT NOT NULL,
  user_id INT,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);
`;

/**
 * Checks that the document FAN_SQL converted to stands its tables as Flow
 * places them, the children in one column right of the parent, never in the
 * grid's one row: an import from the list places its tables before storing.
 */
export function expectFanPlaced(value: string) {
  const { doc, collections } = JSON.parse(value);
  const corners: Record<string, { x: number; y: number }> = Object.fromEntries(
    doc.tableIds.map((id: string) => {
      const { name, ui } = collections.tableEntities[id];
      return [name, { x: ui.x, y: ui.y }];
    })
  );
  const { users, posts, photos } = corners;

  expect(Object.keys(corners).sort()).toEqual(['photos', 'posts', 'users']);
  expect(posts.x).toBeGreaterThan(users.x);
  expect(photos.x).toBe(posts.x);
  expect(photos.y).not.toBe(posts.y);
}
