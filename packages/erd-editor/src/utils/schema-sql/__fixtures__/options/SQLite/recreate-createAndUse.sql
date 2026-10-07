
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS member;
DROP TABLE IF EXISTS post;

-- Members
CREATE TABLE member
(
  id    INTEGER      NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id AUTOINCREMENT)
);

CREATE TABLE post
(
  id        INTEGER      NOT NULL,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id AUTOINCREMENT),
  FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

CREATE INDEX idx_post_title
  ON post (title ASC);
