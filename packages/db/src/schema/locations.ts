import { customType, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { spaces } from './spaces';

/**
 * ltree is a PostgreSQL extension type for hierarchical tree labels.
 * Requires: CREATE EXTENSION IF NOT EXISTS ltree;
 *
 * Drizzle doesn't have a built-in ltree type, so we use customType.
 * The `path` column uses a GIST index for efficient subtree queries
 * using the <@ operator (e.g., path <@ 'root.house.garage').
 */
const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    // Self-referential FK: null means this is a root location in the space.
    // FK constraint (parent_id → locations.id ON DELETE SET NULL) is defined in
    // migration SQL instead of here — TypeScript cannot infer the circular type
    // when the column builder references the table being constructed.
    parentId: uuid('parent_id'),
    // ltree path e.g. "root.house.garage.top_shelf" — computed by application on insert
    path: ltree('path').notNull(),
  },
  (table) => [
    // GIST index enables fast subtree queries: WHERE path <@ 'some.path'
    index('locations_path_idx').using('gist', table.path),
  ]
);

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
