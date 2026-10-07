
USE shop;

CREATE TABLE IF NOT EXISTS member
(
  id    INT          NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) COMMENT 'Members';

ALTER TABLE member
  ADD CONSTRAINT UQ_member_email UNIQUE IF NOT EXISTS (email);

CREATE TABLE IF NOT EXISTS post
(
  id        INT          NOT NULL AUTO_INCREMENT,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY IF NOT EXISTS (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_title
  ON post (title ASC);
