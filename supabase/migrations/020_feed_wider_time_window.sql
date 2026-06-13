-- Extend feed time windows: 48h → 30 days (followed), 72h → 14 days (discovery)
-- With a small user base, strict 48/72h windows produce empty feeds even for
-- users who genuinely follow active creators.

CREATE OR REPLACE FUNCTION get_feed_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followed_ids        UUID[];
  v_followed_categories TEXT[];
  v_followed_count      INT;
  v_purchased_post_ids  UUID[];
  v_followed_posts      JSON;
  v_discovery_posts     JSON;
BEGIN
  SELECT ARRAY_AGG(creator_id) INTO v_followed_ids
  FROM user_following WHERE follower_id = p_user_id;
  v_followed_ids   := COALESCE(v_followed_ids, '{}');
  v_followed_count := COALESCE(array_length(v_followed_ids, 1), 0);

  SELECT ARRAY_AGG(DISTINCT cat) INTO v_followed_categories
  FROM users u, UNNEST(u.categories) AS cat
  WHERE u.id = ANY(v_followed_ids);
  v_followed_categories := COALESCE(v_followed_categories, '{}');

  SELECT ARRAY_AGG(DISTINCT post_id) INTO v_purchased_post_ids
  FROM post_purchases WHERE buyer_id = p_user_id;
  v_purchased_post_ids := COALESCE(v_purchased_post_ids, '{}');

  -- Followed posts + own posts: last 30 days, newest first, max 60
  SELECT JSON_AGG(row_to_json(p)) INTO v_followed_posts FROM (
    SELECT
      posts.id,
      posts.creator_id,
      u.username              AS creator_username,
      u.display_name          AS creator_display_name,
      u.avatar_url            AS creator_avatar_url,
      u.categories,
      u.response_rate         AS creator_response_rate,
      posts.created_at,
      posts.caption,
      posts.image_urls,
      posts.question_count,
      posts.answer_count,
      posts.price,
      posts.location_address,
      (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts
    JOIN users u ON u.id = posts.creator_id
    WHERE (
      posts.creator_id = ANY(v_followed_ids)
      OR posts.creator_id = p_user_id
    )
    AND posts.created_at >= NOW() - INTERVAL '30 days'
    ORDER BY posts.created_at DESC
    LIMIT 60
  ) p;

  -- Discovery posts: non-followed, excluding own, last 14 days, max 100
  SELECT JSON_AGG(row_to_json(p)) INTO v_discovery_posts FROM (
    SELECT
      posts.id,
      posts.creator_id,
      u.username              AS creator_username,
      u.display_name          AS creator_display_name,
      u.avatar_url            AS creator_avatar_url,
      u.categories,
      u.response_rate         AS creator_response_rate,
      posts.created_at,
      posts.caption,
      posts.image_urls,
      posts.question_count,
      posts.answer_count,
      posts.price,
      posts.location_address,
      (posts.id = ANY(v_purchased_post_ids)) AS is_purchased
    FROM posts
    JOIN users u ON u.id = posts.creator_id
    WHERE NOT (posts.creator_id = ANY(v_followed_ids))
      AND posts.creator_id != p_user_id
      AND posts.created_at >= NOW() - INTERVAL '14 days'
    ORDER BY posts.created_at DESC
    LIMIT 100
  ) p;

  RETURN JSON_BUILD_OBJECT(
    'followedPosts',             COALESCE(v_followed_posts,     '[]'::JSON),
    'discoveryPosts',            COALESCE(v_discovery_posts,    '[]'::JSON),
    'followedCreatorCategories', v_followed_categories,
    'followedCreatorCount',      v_followed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_data(UUID) TO authenticated;
