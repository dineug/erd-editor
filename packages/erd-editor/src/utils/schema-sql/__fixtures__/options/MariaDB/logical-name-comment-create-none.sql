
CREATE TABLE member
(
  id    INT          NOT NULL AUTO_INCREMENT COMMENT 'Member ID',
  email VARCHAR(255) NOT NULL COMMENT 'Sign-in address',
  PRIMARY KEY (id)
) COMMENT 'Members';

ALTER TABLE member
  ADD CONSTRAINT UQ_member_email UNIQUE (email);

CREATE TABLE post
(
  id        INT          NOT NULL AUTO_INCREMENT,
  member_id INT          NOT NULL COMMENT 'Author''s member',
  title     VARCHAR(200) NOT NULL COMMENT 'Title',
  PRIMARY KEY (id)
) COMMENT 'Post';

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX idx_post_title
  ON post (title ASC);
