
-- Members
CREATE TABLE member
(
  id    VARCHAR(36)  NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

-- SQLite takes AUTOINCREMENT only on an INTEGER column, so member.id is written without it.

CREATE TABLE post
(
  id        INTEGER      NOT NULL,
  member_id VARCHAR(36)  NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id AUTOINCREMENT),
  FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

CREATE INDEX idx_post_title
  ON post (title ASC);
