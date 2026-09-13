import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),owner:text('owner').notNull(),state:text('state').notNull(),version:integer('version').notNull().default(1)});
export const pushKeys=sqliteTable('push_keys',{workspace:text('workspace').primaryKey(),publicKey:text('public_key').notNull(),privateKey:text('private_key').notNull(),tickKey:text('tick_key').notNull()});
export const pushSubscriptions=sqliteTable('push_subscriptions',{endpoint:text('endpoint').primaryKey(),workspace:text('workspace').notNull(),member:text('member').notNull(),p256dh:text('p256dh').notNull(),auth:text('auth').notNull(),createdAt:text('created_at').notNull()});
export const pushSent=sqliteTable('push_sent',{id:text('id').primaryKey(),workspace:text('workspace').notNull(),sentAt:text('sent_at').notNull()});
export const birthSessions=sqliteTable('birth_sessions',{token:text('token').primaryKey(),workspace:text('workspace').notNull(),actor:text('actor').notNull(),admin:integer('admin').notNull(),expiresAt:text('expires_at').notNull()});
export const passwordCredentials=sqliteTable('password_credentials',{workspace:text('workspace').notNull(),actor:text('actor').notNull(),salt:text('salt').notNull(),hash:text('hash').notNull(),updatedAt:text('updated_at').notNull()});
