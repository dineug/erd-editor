
-- Members
CREATE TABLE member
(
  -- Member ID
  id    INTEGER      NOT NULL,
  -- Sign-in address
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id AUTOINCREMENT)
);

-- Post
CREATE TABLE post
(
  id        INTEGER      NOT NULL,
  -- Author's member
  member_id INT          NOT NULL,
  -- Title
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id AUTOINCREMENT),
  FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

CREATE INDEX idx_post_title
  ON post (title ASC);
