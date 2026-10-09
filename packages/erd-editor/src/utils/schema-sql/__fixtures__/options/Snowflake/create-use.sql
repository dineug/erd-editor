
USE SCHEMA shop;

CREATE TABLE member
(
  id    INT          NOT NULL AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  CONSTRAINT PK_member PRIMARY KEY (id)
)
COMMENT = 'Members';

CREATE TABLE post
(
  id        INT          NOT NULL AUTOINCREMENT,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  CONSTRAINT PK_post PRIMARY KEY (id)
);

-- Snowflake creates no foreign key with a referential action other than NO ACTION, so ON DELETE CASCADE is left out.
ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id);

-- Snowflake has no secondary indexes. idx_post_title on post (title ASC)
-- ALTER TABLE post CLUSTER BY (title);
