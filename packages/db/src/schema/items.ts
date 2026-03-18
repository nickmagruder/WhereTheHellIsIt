import { sql } from 'drizzle-orm';
import { customType, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { locations } from './locations';
import { spaces } from './spaces';
import { users } from './users';

/**
 * tsvector is a PostgreSQL full-text search type.
 * Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm; (for trigram support)
 *
 * Drizzle doesn't have a built-in tsvector type, so we use customType.
 *
 * IMPORTANT: The `search_vector` column is GENERATED ALWAYS AS STORED.
 * Drizzle's generatedAlwaysAs() handles this, but drizzle-kit may not
 * perfectly render the tsvector expression in migrations — verify the
 * generated SQL and adjust manually if needed (see migrations/README).
 */
const tsvector = customType<{ data: string; notNull: true; default: false }>({
  dataType() {
    return 'tsvector';
  },
});

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    // GIN-indexed array of tag strings
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    // Circular FK with photos (photos.item_id → items.id).
    // primary_photo_id → photos.id is intentionally left without a Drizzle
    // .references() call to avoid a circular import. The FK constraint is
    // added in the migration SQL after both tables are created.
    primaryPhotoId: uuid('primary_photo_id'),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    updatedBy: uuid('updated_by')
      .references(() => users.id)
      .notNull(),
    // GENERATED ALWAYS AS STORED — populated automatically by PostgreSQL.
    // Combines name + description + tags into a tsvector for full-text search.
    // Not writable on INSERT/UPDATE; Drizzle excludes it from insert/update types.
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' '))`
    ),
  },
  (table) => [
    // GIN index on tsvector for full-text search (@@ operator)
    index('items_search_idx').using('gin', table.searchVector),
    // GIN index on tags array for containment queries (@> operator)
    index('items_tags_idx').using('gin', table.tags),
  ]
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
