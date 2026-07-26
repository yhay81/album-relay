WITH owner_funnel AS (
  SELECT
    u.id,
    EXISTS (
      SELECT 1 FROM albums a WHERE a.owner_user_id = u.id
    ) AS created_album
  FROM "user" u
),
album_funnel AS (
  SELECT
    a.id,
    EXISTS (
      SELECT 1 FROM photos p WHERE p.album_id = a.id
    ) AS has_photo,
    EXISTS (
      SELECT 1 FROM album_visitors v WHERE v.album_id = a.id
    ) AS has_unlock,
    EXISTS (
      SELECT 1
      FROM album_visitors v
      WHERE v.album_id = a.id AND v.first_viewed_at IS NOT NULL
    ) AS has_view,
    EXISTS (
      SELECT 1
      FROM album_visitors v
      WHERE v.album_id = a.id AND v.first_downloaded_at IS NOT NULL
    ) AS has_download
  FROM albums a
)
SELECT
  COUNT(*) AS users,
  COALESCE(SUM(created_album), 0) AS activated_owners,
  (SELECT COUNT(*) FROM albums) AS albums,
  (SELECT COALESCE(SUM(has_photo), 0) FROM album_funnel) AS albums_with_photo,
  (SELECT COALESCE(SUM(has_unlock), 0) FROM album_funnel) AS shared_albums,
  (SELECT COALESCE(SUM(has_view), 0) FROM album_funnel) AS viewed_albums,
  (SELECT COALESCE(SUM(has_download), 0) FROM album_funnel) AS successful_albums,
  (
    SELECT COUNT(*)
    FROM (
      SELECT owner_user_id
      FROM albums
      GROUP BY owner_user_id
      HAVING COUNT(*) >= 2
    )
  ) AS repeat_owners,
  (
    SELECT COUNT(*)
    FROM "user"
    WHERE created_at >= unixepoch() - 604800
  ) AS signups_7d
FROM owner_funnel;
