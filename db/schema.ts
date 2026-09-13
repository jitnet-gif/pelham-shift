import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),owner:text('owner').notNull(),state:text('state').notNull(),version:integer('version').notNull().default(1)});
