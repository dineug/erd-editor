
CREATE TABLE member
(
  id    UUID         NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so member.id is written without it.

COMMENT ON TABLE member IS 'Members';

CREATE TABLE post
(
  id        INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  member_id UUID         NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX idx_post_title
  ON post (title ASC);
