-- ============================================================
-- oodle — Initial Schema
-- Run this first. All other migrations depend on these tables.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram indexes for username search

-- ============================================================
-- USERS
-- One row per auth.users entry. Role is set at signup and
-- never changes without an admin migration. Profile fields
-- start NULL — the user fills them in after signup.
-- ============================================================
CREATE TABLE users (
  -- Mirrors auth.users.id exactly
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('fan', 'creator')),

  -- Profile (all nullable — empty until user completes onboarding)
  username              TEXT UNIQUE,
  display_name          TEXT,
  avatar_url            TEXT,
  bio                   TEXT CHECK (char_length(bio) <= 200),

  -- Creator-only fields (fans will always have these as NULL / default)
  categories            TEXT[]           DEFAULT '{}',
  default_answer_price  NUMERIC(10,2)    DEFAULT 4.99,

  -- Stripe Connect (populated during Step 6 payout onboarding)
  stripe_account_id     TEXT,
  stripe_onboarded      BOOLEAN          DEFAULT FALSE,

  -- Denormalized counters (maintained by triggers below)
  followers_count       INTEGER NOT NULL DEFAULT 0,
  following_count       INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- POSTS
-- Created by creators. Fans ask questions on posts.
-- image_urls stores ordered Supabase Storage public URLs.
-- price NULL = answer is free to see; price > 0 = pay to unlock.
-- question_count / answer_count are denormalized for feed scoring.
-- ============================================================
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  caption         TEXT CHECK (char_length(caption) <= 2200),
  image_urls      TEXT[]           NOT NULL DEFAULT '{}',

  -- Unlock pricing: NULL means seeing any answer is free
  price           NUMERIC(10,2),

  -- Denormalized (maintained by triggers)
  question_count  INTEGER NOT NULL DEFAULT 0,
  answer_count    INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- THREADS
-- One thread = one fan ↔ creator Q&A conversation on a post.
-- A fan can have at most one thread per post (UNIQUE constraint).
-- The creator sets/adjusts price before answering.
-- answer_blocks stores the rich answer (text/photo/list/etc.) as JSONB.
-- ============================================================
CREATE TABLE threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Price the fan must pay to unlock the answer
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'clarification'
                    CHECK (status IN ('clarification', 'answered')),

  -- Answer content (set when creator submits answer)
  answer_blocks   JSONB,        -- AnswerBlock[] — rich content
  answer_text     TEXT,         -- plain-text fallback (derived from blocks)
  answered_at     TIMESTAMPTZ,

  -- Tracks whether the original asker has opened the answer
  asker_has_viewed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One thread per fan per post
  UNIQUE (post_id, fan_id),
  -- Prevent self-threading
  CHECK (fan_id != creator_id)
);

-- ============================================================
-- MESSAGES
-- Ordered conversation inside a thread.
-- Both fan and creator can send messages during 'clarification'.
-- ============================================================
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- POST_PURCHASES
-- Records every fan who has paid to unlock a thread's answer.
-- The original asker (fan_id on the thread) must also purchase
-- before seeing the answer. Other fans can purchase the same
-- answer independently (discovery purchases from the feed).
--
-- stripe_payment_intent_id is populated by the Stripe webhook
-- (Step 6). Until Stripe is wired, inserts can come directly
-- from the client for development purposes.
-- ============================================================
CREATE TABLE post_purchases (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id                 UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  post_id                   UUID NOT NULL REFERENCES posts(id)   ON DELETE CASCADE,
  buyer_id                  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  creator_id                UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  amount                    NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id  TEXT UNIQUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One purchase per (thread, buyer) pair
  UNIQUE (thread_id, buyer_id)
);

-- ============================================================
-- USER_FOLLOWING
-- Composite PK — no surrogate key needed.
-- Fans can follow creators; the social graph is directed.
-- ============================================================
CREATE TABLE user_following (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, creator_id),
  CHECK (follower_id != creator_id)
);
