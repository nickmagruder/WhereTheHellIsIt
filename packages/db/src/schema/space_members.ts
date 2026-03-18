import { index, pgEnum, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { spaces } from './spaces';
import { users } from './users';

// pgEnum enforces the constraint at the DB level (not just a check constraint)
export const roleEnum = pgEnum('role', ['owner', 'editor', 'viewer']);

export const spaceMembers = pgTable(
  'space_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: roleEnum('role').notNull(),
    // nullable — null means the user is the original owner (self-added)
    invitedBy: uuid('invited_by').references(() => users.id),
  },
  (table) => [
    unique('space_members_space_id_user_id_unique').on(table.spaceId, table.userId),
    index('space_members_user_id_idx').on(table.userId),
  ]
);

export type SpaceMember = typeof spaceMembers.$inferSelect;
export type NewSpaceMember = typeof spaceMembers.$inferInsert;
