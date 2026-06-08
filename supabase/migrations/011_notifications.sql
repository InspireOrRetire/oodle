-- ============================================================
-- 011 – Notifications
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  notification_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  type             TEXT        NOT NULL,
  -- type values:
  --   new_question       creator received a question on a post
  --   new_dm_question    creator received a question via DM
  --   answer_dropped     fan's question was answered
  --   payment_received   creator received payment
  --   payment_processed  fan's payment was processed
  --   dm_followup        new message in a question thread
  --   question_declined  creator declined a question
  reference_id     UUID,
  reference_type   TEXT        CHECK (reference_type IN ('thread', 'post', 'payment')),
  message          TEXT        NOT NULL,
  read             BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON notifications (recipient_id, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- Service role (backend triggers) can insert
CREATE POLICY "service inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── Triggers: auto-create notifications on thread events ─────────────────────

-- Helper: insert a notification row
CREATE OR REPLACE FUNCTION notify_insert(
  p_recipient_id   UUID,
  p_actor_id       UUID,
  p_type           TEXT,
  p_reference_id   UUID,
  p_reference_type TEXT,
  p_message        TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications
    (recipient_id, actor_id, type, reference_id, reference_type, message)
  VALUES
    (p_recipient_id, p_actor_id, p_type, p_reference_id, p_reference_type, p_message);
END;
$$;

-- Trigger: new thread created → notify creator (new question)
CREATE OR REPLACE FUNCTION trg_thread_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fan_name TEXT;
  v_post_caption TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO v_fan_name
    FROM users WHERE id = NEW.fan_id;

  IF NEW.post_id IS NOT NULL THEN
    SELECT COALESCE(LEFT(caption, 40), 'your post') INTO v_post_caption
      FROM posts WHERE id = NEW.post_id;
    PERFORM notify_insert(
      NEW.creator_id, NEW.fan_id,
      'new_question', NEW.id, 'thread',
      v_fan_name || ' asked a question on "' || v_post_caption || '"'
    );
  ELSE
    PERFORM notify_insert(
      NEW.creator_id, NEW.fan_id,
      'new_dm_question', NEW.id, 'thread',
      v_fan_name || ' sent you a DM question'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_thread_created ON threads;
CREATE TRIGGER on_thread_created
  AFTER INSERT ON threads
  FOR EACH ROW EXECUTE FUNCTION trg_thread_created();

-- Trigger: thread status → answered → notify fan
CREATE OR REPLACE FUNCTION trg_thread_answered() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_name TEXT;
BEGIN
  IF NEW.status = 'answered' AND OLD.status <> 'answered' THEN
    SELECT COALESCE(display_name, username, 'Your creator') INTO v_creator_name
      FROM users WHERE id = NEW.creator_id;
    -- Notify fan: answer dropped
    PERFORM notify_insert(
      NEW.fan_id, NEW.creator_id,
      'answer_dropped', NEW.id, 'thread',
      v_creator_name || ' answered your question'
    );
    -- Notify creator: payment received
    PERFORM notify_insert(
      NEW.creator_id, NEW.fan_id,
      'payment_received', NEW.id, 'payment',
      'Payment of ' || NEW.price || ' tokens received for your answer'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_thread_answered ON threads;
CREATE TRIGGER on_thread_answered
  AFTER UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION trg_thread_answered();

-- Trigger: new message in thread → notify the other party
CREATE OR REPLACE FUNCTION trg_message_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_thread threads%ROWTYPE;
  v_sender_name TEXT;
  v_recipient_id UUID;
BEGIN
  SELECT * INTO v_thread FROM threads WHERE id = NEW.thread_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_sender_name
    FROM users WHERE id = NEW.sender_id;

  -- Determine recipient: the other participant
  IF NEW.sender_id = v_thread.creator_id THEN
    v_recipient_id := v_thread.fan_id;
    PERFORM notify_insert(
      v_recipient_id, NEW.sender_id,
      'dm_followup', NEW.thread_id, 'thread',
      v_sender_name || ' replied to your question'
    );
  ELSIF NEW.sender_id = v_thread.fan_id THEN
    v_recipient_id := v_thread.creator_id;
    -- Only notify creator for follow-up messages (thread already exists — not first message)
    IF (SELECT COUNT(*) FROM messages WHERE thread_id = NEW.thread_id) > 1 THEN
      PERFORM notify_insert(
        v_recipient_id, NEW.sender_id,
        'dm_followup', NEW.thread_id, 'thread',
        v_sender_name || ' followed up on their question'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trg_message_created();
