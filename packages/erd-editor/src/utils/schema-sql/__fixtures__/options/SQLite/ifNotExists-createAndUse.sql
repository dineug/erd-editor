
-- Members
CREATE TABLE IF NOT EXISTS member
(
  id    INTEGER      NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS post
(
  id        INTEGER      NOT NULL,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id AUTOINCREMENT),
  FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_title
  ON post (title ASC);
