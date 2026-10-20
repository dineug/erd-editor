
CREATE TABLE member
(
  id    INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

COMMENT ON TABLE member IS 'Members';

COMMENT ON COLUMN member.id IS 'Member ID';

COMMENT ON COLUMN member.email IS 'Sign-in address';

CREATE TABLE post
(
  id        INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id)
);

COMMENT ON TABLE post IS 'Post';

COMMENT ON COLUMN post.member_id IS 'Author''s member';

COMMENT ON COLUMN post.title IS 'Title';

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX idx_post_title
  ON post (title ASC);
