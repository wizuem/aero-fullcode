/*
# Create chat_messages, user_settings, and user_bookmarks tables for aero.

## Overview
This migration creates the database schema for the aero. browser app:
- A public real-time chat room where all visitors can talk
- Per-user settings (theme, privacy preferences) for signed-in users
- Per-user bookmarks for the browser

## New Tables

### chat_messages
- id (uuid, PK)
- username (text, display name for the message sender)
- content (text, the message body, max 2000 chars)
- created_at (timestamptz, defaults to now())
- Public read/write for anon + authenticated (it's a shared chat room)

### user_settings
- id (uuid, PK)
- user_id (uuid, FK to auth.users, defaults to auth.uid())
- theme (text, default 'dark')
- accent_color (text, default 'blue')
- privacy_clear_on_exit (boolean, default false)
- privacy_block_trackers (boolean, default true)
- privacy_dnt (boolean, default true)
- updated_at (timestamptz, defaults to now())
- Owner-scoped CRUD (authenticated only)

### user_bookmarks
- id (uuid, PK)
- user_id (uuid, FK to auth.users, defaults to auth.uid())
- url (text, the bookmarked URL)
- title (text, display title)
- favicon (text, optional favicon URL)
- created_at (timestamptz, defaults to now())
- Owner-scoped CRUD (authenticated only)

## Security
- RLS enabled on all tables
- chat_messages: public CRUD (anon + authenticated) — shared chat room
- user_settings: owner-scoped CRUD (authenticated only)
- user_bookmarks: owner-scoped CRUD (authenticated only)
- user_id columns on owner-scoped tables default to auth.uid()
*/

-- Chat messages table (public chat room)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL DEFAULT 'Anonymous',
  content text NOT NULL CHECK (char_length(content) <= 2000 AND char_length(content) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_chat" ON chat_messages;
CREATE POLICY "anon_select_chat" ON chat_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chat" ON chat_messages;
CREATE POLICY "anon_insert_chat" ON chat_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chat" ON chat_messages;
CREATE POLICY "anon_delete_chat" ON chat_messages FOR DELETE
  TO anon, authenticated USING (true);

-- User settings table (per-user, authenticated only)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark',
  accent_color text NOT NULL DEFAULT 'blue',
  privacy_clear_on_exit boolean NOT NULL DEFAULT false,
  privacy_block_trackers boolean NOT NULL DEFAULT true,
  privacy_dnt boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- User bookmarks table (per-user, authenticated only)
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  favicon text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bookmarks" ON user_bookmarks;
CREATE POLICY "select_own_bookmarks" ON user_bookmarks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bookmarks" ON user_bookmarks;
CREATE POLICY "insert_own_bookmarks" ON user_bookmarks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bookmarks" ON user_bookmarks;
CREATE POLICY "update_own_bookmarks" ON user_bookmarks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bookmarks" ON user_bookmarks;
CREATE POLICY "delete_own_bookmarks" ON user_bookmarks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);