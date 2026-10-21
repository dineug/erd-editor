
CREATE TABLE member
(
  id    INT          NOT NULL IDENTITY(1,1),
  email VARCHAR(255) NOT NULL,
  CONSTRAINT PK_member PRIMARY KEY (id)
)
GO

ALTER TABLE member
  ADD CONSTRAINT UQ_member_email UNIQUE (email)
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Members', 'schema', 'dbo', 'table', 'member'
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Member ID', 'schema', 'dbo', 'table', 'member', 'column', 'id'
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Sign-in address', 'schema', 'dbo', 'table', 'member', 'column', 'email'
GO

CREATE TABLE post
(
  id        INT          NOT NULL IDENTITY(1,1),
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  CONSTRAINT PK_post PRIMARY KEY (id)
)
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Post', 'schema', 'dbo', 'table', 'post'
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Author''s member', 'schema', 'dbo', 'table', 'post', 'column', 'member_id'
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  N'Title', 'schema', 'dbo', 'table', 'post', 'column', 'title'
GO

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE
GO

CREATE INDEX idx_post_title
  ON post (title ASC)
GO
