import { time } from 'console'
import {integer, varchar, pgTable, serial, text, timestamp, jsonb, boolean} from 'drizzle-orm/pg-core'

export const Users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', {length: 255}).notNull().unique(),
    name: varchar('name', {length: 255}).notNull(),
    role: varchar('role', {length: 50}).default('user').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const Reports = pgTable('reports', {
    location: text('location').notNull(),
    wasteType: varchar('waste_type', {length: 255}).notNull(),
    amount: varchar('amount', {length: 255}).notNull(),
    imageUrl: text('image_url'),
    verificationResult: jsonb('verification_result'),
    status: varchar('statue', {length:255}).notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    collectorId: integer('collector_id').references(()=> Users.id),
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(()=>Users.id).notNull()
})

export const Rewards = pgTable('rewards', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(()=>Users.id).notNull(),
    points: integer('points').notNull().default(0),
    level: integer("level").notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    isAvailable: boolean('is_available').notNull().default(true),
    description: text('description'),
    name: varchar('name', {length: 255}).notNull(),
    collectionInfo: text('collection_info').notNull()
})

export const CollectedWastes = pgTable('collected_waste', {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').references(()=>Reports.id).notNull(),
    collectorId: integer('collector_id').references(()=>Users.id).notNull(),
    collectionDates: timestamp('collection_dates').notNull(),
    status: varchar('status', {length: 255}).notNull().default('Collected')
})

export const Notifications = pgTable('notifications', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(()=>Users.id).notNull(),
    message: text('message').notNull(),
    type: varchar('type', {length: 50}).notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const Transactions = pgTable('transactions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(()=>Users.id).notNull(),
    description: text('description').notNull(),
    type: varchar('type', {length: 20}).notNull(),
    amount: integer('amount').notNull(),
    date: timestamp('created_at').defaultNow().notNull()
})