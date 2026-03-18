import { integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { items } from './items';
import { users } from './users';

// pgEnum enforces upload lifecycle states at the DB level
export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .references(() => items.id, { onDelete: 'cascade' })
    .notNull(),
  // S3 key of the original upload: uploads/{cognito-identity-id}/{uuid}.jpg
  s3Key: text('s3_key').notNull(),
  // Keys written by the photo-processor Lambda after Sharp processing
  thumbnailKey: text('thumbnail_key'), // thumbnails/{uuid}_thumb.webp  (400×400 cover crop)
  mediumKey: text('medium_key'),       // thumbnails/{uuid}_medium.webp (1200px wide)
  uploadStatus: uploadStatusEnum('upload_status').notNull().default('pending'),
  // Controls display order within an item's photo gallery
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
