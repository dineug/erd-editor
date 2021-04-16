CREATE TABLE `article` (
	`id`	bigint(20)	NOT NULL,
	`category_id`	varchar(255)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`a_nick_name`	varchar(255)	NULL,
	`anonymity`	bit(1)	NOT NULL,
	`author_id`	bigint(20)	NULL,
	`choice`	bit(1)	NOT NULL,
	`content_id`	bigint(20)	NULL,
	`create_ip`	varchar(255)	NULL,
	`date_created`	datetime	NOT NULL,
	`enabled`	bit(1)	NOT NULL,
	`is_recruit`	bit(1)	NOT NULL,
	`last_editor_id`	bigint(20)	NULL,
	`last_updated`	datetime	NOT NULL,
	`note_count`	int(11)	NOT NULL,
	`scrap_count`	int(11)	NOT NULL,
	`selected_note_id`	bigint(20)	NULL,
	`tag_string`	varchar(255)	NULL,
	`title`	varchar(255)	NOT NULL,
	`view_count`	int(11)	NOT NULL,
	`vote_count`	int(11)	NOT NULL
);

CREATE TABLE `user_role` (
	`user_id`	bigint(20)	NOT NULL,
	`role_id`	bigint(20)	NOT NULL
);

CREATE TABLE `area_district_code` (
	`id`	varchar(255)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`area_city_code_id`	varchar(255)	NOT NULL,
	`name`	varchar(255)	NOT NULL
);

CREATE TABLE `avatar_tag` (
	`avatar_tags_id`	bigint(20)	NULL,
	`tag_id`	bigint(20)	NULL
);

CREATE TABLE `notification_read` (
	`id`	bigint(20)	NOT NULL,
	`avatar_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`last_read`	datetime	NOT NULL
);

CREATE TABLE `confirm_email` (
	`id`	bigint(20)	NOT NULL,
	`user_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_expired`	datetime	NOT NULL,
	`email`	varchar(255)	NOT NULL,
	`secured_key`	varchar(255)	NOT NULL
);

CREATE TABLE `job_position_tag` (
	`job_position_tags_id`	bigint(20)	NULL,
	`tag_id`	bigint(20)	NULL
);

CREATE TABLE `content_file` (
	`content_files_id`	bigint(20)	NULL,
	`file_id`	bigint(20)	NULL
);

CREATE TABLE `banner_click` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`banner_id`	bigint(20)	NOT NULL,
	`click_count`	int(11)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`ip`	varchar(255)	NOT NULL
);

CREATE TABLE `job_position` (
	`id`	bigint(20)	NOT NULL,
	`recruit_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`description`	varchar(255)	NOT NULL,
	`job_pay_type`	varchar(255)	NOT NULL,
	`max_career`	int(11)	NULL,
	`min_career`	int(11)	NOT NULL,
	`tag_string`	varchar(255)	NULL,
	`title`	varchar(255)	NOT NULL
);

CREATE TABLE `oauthid` (
	`id`	bigint(20)	NOT NULL,
	`user_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`access_token`	varchar(255)	NOT NULL,
	`provider`	varchar(255)	NOT NULL
);

CREATE TABLE `opinion` (
	`id`	bigint(20)	NOT NULL,
	`content_id`	bigint(20)	NOT NULL,
	`author_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`comment`	longtext	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`last_updated`	datetime	NOT NULL,
	`vote_count`	int(11)	NOT NULL
);

CREATE TABLE `scrap` (
	`avatar_id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL
);

CREATE TABLE `banner` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`image`	varchar(255)	NULL,
	`last_updated`	datetime	NOT NULL,
	`name`	varchar(255)	NOT NULL,
	`target`	varchar(255)	NULL,
	`type`	varchar(255)	NOT NULL,
	`url`	varchar(255)	NOT NULL,
	`visible`	bit(1)	NOT NULL
);

CREATE TABLE `category` (
	`code`	varchar(255)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`anonymity`	bit(1)	NULL,
	`date_created`	datetime	NOT NULL,
	`default_label`	varchar(255)	NOT NULL,
	`enabled`	bit(1)	NOT NULL,
	`external_link`	varchar(255)	NULL,
	`icon_css_names`	varchar(255)	NULL,
	`isurl`	bit(1)	NOT NULL,
	`label_code`	varchar(255)	NOT NULL,
	`last_updated`	datetime	NOT NULL,
	`level`	int(11)	NOT NULL,
	`parent_id`	varchar(255)	NULL,
	`require_tag`	bit(1)	NOT NULL,
	`sort_order`	int(11)	NOT NULL,
	`url`	varchar(255)	NULL,
	`use_evaluate`	bit(1)	NOT NULL,
	`use_note`	bit(1)	NOT NULL,
	`use_opinion`	bit(1)	NOT NULL,
	`use_tag`	bit(1)	NOT NULL,
	`writable`	bit(1)	NOT NULL,
	`write_by_external_link`	bit(1)	NULL
);

CREATE TABLE `anonymous` (
	`id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`user_id`	bigint(20)	NOT NULL,
	`content_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`type`	varchar(255)	NOT NULL
);

CREATE TABLE `company_info` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`company_id`	bigint(20)	NULL,
	`description`	longtext	NULL,
	`email`	varchar(255)	NOT NULL,
	`employee_number`	int(11)	NOT NULL,
	`homepage_url`	varchar(255)	NULL,
	`tel`	varchar(255)	NOT NULL,
	`welfare`	longtext	NULL
);

CREATE TABLE `article_tag` (
	`article_tags_id`	bigint(20)	NULL,
	`tag_id`	bigint(20)	NULL
);

CREATE TABLE `resume` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL
);

CREATE TABLE `area_city_code` (
	`id`	varchar(255)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`name`	varchar(255)	NOT NULL
);

CREATE TABLE `career` (
	`id`	bigint(20)	NOT NULL,
	`company_id`	bigint(20)	NOT NULL,
	`resume_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL
);

CREATE TABLE `spam_word` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`text`	varchar(255)	NOT NULL
);

CREATE TABLE `file` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`attach_type`	varchar(255)	NOT NULL,
	`byte_size`	int(11)	NOT NULL,
	`height`	int(11)	NOT NULL,
	`name`	varchar(255)	NOT NULL,
	`org_name`	varchar(255)	NOT NULL,
	`type`	varchar(255)	NOT NULL,
	`width`	int(11)	NOT NULL
);

CREATE TABLE `avatar` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`activity_point`	int(11)	NOT NULL,
	`nickname`	varchar(20)	NOT NULL,
	`official`	bit(1)	NULL,
	`picture`	varchar(255)	NOT NULL,
	`picture_type`	int(11)	NOT NULL
);

CREATE TABLE `content_vote` (
	`id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`voter_id`	bigint(20)	NOT NULL,
	`content_id`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`point`	int(11)	NOT NULL
);

CREATE TABLE `user` (
	`id`	bigint(20)	NOT NULL,
	`avatar_id`	bigint(20)	NOT NULL,
	`person_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`account_expired`	bit(1)	NOT NULL,
	`account_locked`	bit(1)	NOT NULL,
	`create_ip`	varchar(255)	NULL,
	`date_created`	datetime	NOT NULL,
	`date_withdraw`	datetime	NULL,
	`enabled`	bit(1)	NOT NULL,
	`last_password_changed`	datetime	NOT NULL,
	`last_update_ip`	varchar(255)	NULL,
	`last_updated`	datetime	NOT NULL,
	`password`	varchar(255)	NOT NULL,
	`password_expired`	bit(1)	NOT NULL,
	`username`	varchar(15)	NOT NULL,
	`withdraw`	bit(1)	NOT NULL
);

CREATE TABLE `tag_similar_text` (
	`id`	bigint(20)	NOT NULL,
	`tag_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`text`	varchar(255)	NOT NULL
);

CREATE TABLE `tag` (
	`id`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`description`	varchar(255)	NULL,
	`name`	varchar(255)	NOT NULL,
	`tagged_count`	int(11)	NOT NULL
);

CREATE TABLE `company` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`enabled`	bit(1)	NOT NULL,
	`locked`	bit(1)	NOT NULL,
	`logo`	varchar(255)	NULL,
	`manager_id`	bigint(20)	NULL,
	`name`	varchar(255)	NOT NULL,
	`register_number`	varchar(255)	NOT NULL
);

CREATE TABLE `person` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`company_id`	bigint(20)	NULL,
	`date_created`	datetime	NOT NULL,
	`dm_allowed`	bit(1)	NOT NULL,
	`email`	varchar(255)	NOT NULL,
	`full_name`	varchar(255)	NOT NULL,
	`homepage_url`	varchar(255)	NULL,
	`last_updated`	datetime	NOT NULL,
	`resume_id`	bigint(20)	NULL
);

CREATE TABLE `role` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`authority`	varchar(255)	NOT NULL
);

CREATE TABLE `content` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`a_nick_name`	varchar(255)	NULL,
	`anonymity`	bit(1)	NOT NULL,
	`article_id`	bigint(20)	NULL,
	`author_id`	bigint(20)	NULL,
	`create_ip`	varchar(255)	NULL,
	`date_created`	datetime	NOT NULL,
	`last_editor_id`	bigint(20)	NULL,
	`last_updated`	datetime	NOT NULL,
	`selected`	bit(1)	NOT NULL,
	`text`	longtext	NOT NULL,
	`text_type`	int(11)	NOT NULL,
	`type`	int(11)	NOT NULL,
	`vote_count`	int(11)	NOT NULL
);

CREATE TABLE `logged_in` (
	`id`	bigint(20)	NOT NULL,
	`user_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`remote_addr`	varchar(255)	NULL
);

CREATE TABLE `activity` (
	`id`	bigint(20)	NOT NULL,
	`avatar_id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`content_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`last_updated`	datetime	NOT NULL,
	`point`	int(11)	NOT NULL,
	`point_type`	varchar(255)	NOT NULL,
	`type`	varchar(255)	NOT NULL
);

CREATE TABLE `recruit` (
	`id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`city`	varchar(255)	NOT NULL,
	`closed`	bit(1)	NOT NULL,
	`company_id`	bigint(20)	NULL,
	`district`	varchar(255)	NOT NULL,
	`email`	varchar(255)	NOT NULL,
	`job_type`	varchar(255)	NOT NULL,
	`start_date`	varchar(255)	NULL,
	`tel`	varchar(255)	NOT NULL,
	`working_month`	int(11)	NULL
);

CREATE TABLE `notification` (
	`id`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`sender_id`	bigint(20)	NOT NULL,
	`receiver_id`	bigint(20)	NOT NULL,
	`content_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL,
	`last_updated`	datetime	NOT NULL,
	`type`	varchar(255)	NOT NULL
);

CREATE TABLE `change_log` (
	`id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL,
	`article_id`	bigint(20)	NOT NULL,
	`avatar_id`	bigint(20)	NULL,
	`content_id`	bigint(20)	NULL,
	`date_created`	datetime	NOT NULL,
	`md5`	varchar(255)	NOT NULL,
	`patch`	longtext	NOT NULL,
	`revision`	int(11)	NOT NULL,
	`type`	varchar(255)	NOT NULL
);

CREATE TABLE `managed_user` (
	`id`	bigint(20)	NOT NULL,
	`user_id`	bigint(20)	NOT NULL,
	`version`	bigint(20)	NOT NULL
);

CREATE TABLE `follow` (
	`follower_id`	bigint(20)	NOT NULL,
	`following_id`	bigint(20)	NOT NULL,
	`date_created`	datetime	NOT NULL
);

ALTER TABLE `article` ADD CONSTRAINT `PK_ARTICLE` PRIMARY KEY (
	`id`
);

ALTER TABLE `user_role` ADD CONSTRAINT `PK_USER_ROLE` PRIMARY KEY (
	`user_id`,
	`role_id`
);

ALTER TABLE `area_district_code` ADD CONSTRAINT `PK_AREA_DISTRICT_CODE` PRIMARY KEY (
	`id`
);

ALTER TABLE `notification_read` ADD CONSTRAINT `PK_NOTIFICATION_READ` PRIMARY KEY (
	`id`
);

ALTER TABLE `confirm_email` ADD CONSTRAINT `PK_CONFIRM_EMAIL` PRIMARY KEY (
	`id`
);

ALTER TABLE `banner_click` ADD CONSTRAINT `PK_BANNER_CLICK` PRIMARY KEY (
	`id`
);

ALTER TABLE `job_position` ADD CONSTRAINT `PK_JOB_POSITION` PRIMARY KEY (
	`id`
);

ALTER TABLE `oauthid` ADD CONSTRAINT `PK_OAUTHID` PRIMARY KEY (
	`id`
);

ALTER TABLE `opinion` ADD CONSTRAINT `PK_OPINION` PRIMARY KEY (
	`id`
);

ALTER TABLE `scrap` ADD CONSTRAINT `PK_SCRAP` PRIMARY KEY (
	`avatar_id`,
	`article_id`
);

ALTER TABLE `banner` ADD CONSTRAINT `PK_BANNER` PRIMARY KEY (
	`id`
);

ALTER TABLE `category` ADD CONSTRAINT `PK_CATEGORY` PRIMARY KEY (
	`code`
);

ALTER TABLE `anonymous` ADD CONSTRAINT `PK_ANONYMOUS` PRIMARY KEY (
	`id`
);

ALTER TABLE `company_info` ADD CONSTRAINT `PK_COMPANY_INFO` PRIMARY KEY (
	`id`
);

ALTER TABLE `resume` ADD CONSTRAINT `PK_RESUME` PRIMARY KEY (
	`id`
);

ALTER TABLE `area_city_code` ADD CONSTRAINT `PK_AREA_CITY_CODE` PRIMARY KEY (
	`id`
);

ALTER TABLE `career` ADD CONSTRAINT `PK_CAREER` PRIMARY KEY (
	`id`
);

ALTER TABLE `spam_word` ADD CONSTRAINT `PK_SPAM_WORD` PRIMARY KEY (
	`id`
);

ALTER TABLE `file` ADD CONSTRAINT `PK_FILE` PRIMARY KEY (
	`id`
);

ALTER TABLE `avatar` ADD CONSTRAINT `PK_AVATAR` PRIMARY KEY (
	`id`
);

ALTER TABLE `content_vote` ADD CONSTRAINT `PK_CONTENT_VOTE` PRIMARY KEY (
	`id`
);

ALTER TABLE `user` ADD CONSTRAINT `PK_USER` PRIMARY KEY (
	`id`
);

ALTER TABLE `tag_similar_text` ADD CONSTRAINT `PK_TAG_SIMILAR_TEXT` PRIMARY KEY (
	`id`
);

ALTER TABLE `tag` ADD CONSTRAINT `PK_TAG` PRIMARY KEY (
	`id`
);

ALTER TABLE `company` ADD CONSTRAINT `PK_COMPANY` PRIMARY KEY (
	`id`
);

ALTER TABLE `person` ADD CONSTRAINT `PK_PERSON` PRIMARY KEY (
	`id`
);

ALTER TABLE `role` ADD CONSTRAINT `PK_ROLE` PRIMARY KEY (
	`id`
);

ALTER TABLE `content` ADD CONSTRAINT `PK_CONTENT` PRIMARY KEY (
	`id`
);

ALTER TABLE `logged_in` ADD CONSTRAINT `PK_LOGGED_IN` PRIMARY KEY (
	`id`
);

ALTER TABLE `activity` ADD CONSTRAINT `PK_ACTIVITY` PRIMARY KEY (
	`id`
);

ALTER TABLE `recruit` ADD CONSTRAINT `PK_RECRUIT` PRIMARY KEY (
	`id`
);

ALTER TABLE `notification` ADD CONSTRAINT `PK_NOTIFICATION` PRIMARY KEY (
	`id`
);

ALTER TABLE `change_log` ADD CONSTRAINT `PK_CHANGE_LOG` PRIMARY KEY (
	`id`
);

ALTER TABLE `managed_user` ADD CONSTRAINT `PK_MANAGED_USER` PRIMARY KEY (
	`id`
);

ALTER TABLE `follow` ADD CONSTRAINT `PK_FOLLOW` PRIMARY KEY (
	`follower_id`,
	`following_id`
);

ALTER TABLE `article` ADD CONSTRAINT `FK_category_TO_article_1` FOREIGN KEY (
	`category_id`
)
REFERENCES `category` (
	`code`
);

ALTER TABLE `article` ADD CONSTRAINT `FK_avatar_TO_article_1` FOREIGN KEY (
	`author_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `article` ADD CONSTRAINT `FK_avatar_TO_article_2` FOREIGN KEY (
	`last_editor_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `article` ADD CONSTRAINT `FK_content_TO_article_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `article` ADD CONSTRAINT `FK_content_TO_article_2` FOREIGN KEY (
	`selected_note_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `user_role` ADD CONSTRAINT `FK_user_TO_user_role_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `user_role` ADD CONSTRAINT `FK_role_TO_user_role_1` FOREIGN KEY (
	`role_id`
)
REFERENCES `role` (
	`id`
);

ALTER TABLE `area_district_code` ADD CONSTRAINT `FK_area_city_code_TO_area_district_code_1` FOREIGN KEY (
	`area_city_code_id`
)
REFERENCES `area_city_code` (
	`id`
);

ALTER TABLE `avatar_tag` ADD CONSTRAINT `FK_avatar_TO_avatar_tag_1` FOREIGN KEY (
	`avatar_tags_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `avatar_tag` ADD CONSTRAINT `FK_tag_TO_avatar_tag_1` FOREIGN KEY (
	`tag_id`
)
REFERENCES `tag` (
	`id`
);

ALTER TABLE `notification_read` ADD CONSTRAINT `FK_avatar_TO_notification_read_1` FOREIGN KEY (
	`avatar_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `confirm_email` ADD CONSTRAINT `FK_user_TO_confirm_email_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `job_position_tag` ADD CONSTRAINT `FK_job_position_TO_job_position_tag_1` FOREIGN KEY (
	`job_position_tags_id`
)
REFERENCES `job_position` (
	`id`
);

ALTER TABLE `job_position_tag` ADD CONSTRAINT `FK_tag_TO_job_position_tag_1` FOREIGN KEY (
	`tag_id`
)
REFERENCES `tag` (
	`id`
);

ALTER TABLE `content_file` ADD CONSTRAINT `FK_content_TO_content_file_1` FOREIGN KEY (
	`content_files_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `content_file` ADD CONSTRAINT `FK_file_TO_content_file_1` FOREIGN KEY (
	`file_id`
)
REFERENCES `file` (
	`id`
);

ALTER TABLE `banner_click` ADD CONSTRAINT `FK_banner_TO_banner_click_1` FOREIGN KEY (
	`banner_id`
)
REFERENCES `banner` (
	`id`
);

ALTER TABLE `job_position` ADD CONSTRAINT `FK_recruit_TO_job_position_1` FOREIGN KEY (
	`recruit_id`
)
REFERENCES `recruit` (
	`id`
);

ALTER TABLE `oauthid` ADD CONSTRAINT `FK_user_TO_oauthid_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `opinion` ADD CONSTRAINT `FK_content_TO_opinion_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `opinion` ADD CONSTRAINT `FK_avatar_TO_opinion_1` FOREIGN KEY (
	`author_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `scrap` ADD CONSTRAINT `FK_avatar_TO_scrap_1` FOREIGN KEY (
	`avatar_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `scrap` ADD CONSTRAINT `FK_article_TO_scrap_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `category` ADD CONSTRAINT `FK_category_TO_category_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `category` (
	`code`
);

ALTER TABLE `anonymous` ADD CONSTRAINT `FK_article_TO_anonymous_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `anonymous` ADD CONSTRAINT `FK_user_TO_anonymous_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `anonymous` ADD CONSTRAINT `FK_content_TO_anonymous_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `company_info` ADD CONSTRAINT `FK_company_TO_company_info_1` FOREIGN KEY (
	`company_id`
)
REFERENCES `company` (
	`id`
);

ALTER TABLE `article_tag` ADD CONSTRAINT `FK_article_TO_article_tag_1` FOREIGN KEY (
	`article_tags_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `article_tag` ADD CONSTRAINT `FK_tag_TO_article_tag_1` FOREIGN KEY (
	`tag_id`
)
REFERENCES `tag` (
	`id`
);

ALTER TABLE `career` ADD CONSTRAINT `FK_company_TO_career_1` FOREIGN KEY (
	`company_id`
)
REFERENCES `company` (
	`id`
);

ALTER TABLE `career` ADD CONSTRAINT `FK_resume_TO_career_1` FOREIGN KEY (
	`resume_id`
)
REFERENCES `resume` (
	`id`
);

ALTER TABLE `content_vote` ADD CONSTRAINT `FK_article_TO_content_vote_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `content_vote` ADD CONSTRAINT `FK_avatar_TO_content_vote_1` FOREIGN KEY (
	`voter_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `content_vote` ADD CONSTRAINT `FK_content_TO_content_vote_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `user` ADD CONSTRAINT `FK_avatar_TO_user_1` FOREIGN KEY (
	`avatar_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `user` ADD CONSTRAINT `FK_person_TO_user_1` FOREIGN KEY (
	`person_id`
)
REFERENCES `person` (
	`id`
);

ALTER TABLE `tag_similar_text` ADD CONSTRAINT `FK_tag_TO_tag_similar_text_1` FOREIGN KEY (
	`tag_id`
)
REFERENCES `tag` (
	`id`
);

ALTER TABLE `company` ADD CONSTRAINT `FK_person_TO_company_1` FOREIGN KEY (
	`manager_id`
)
REFERENCES `person` (
	`id`
);

ALTER TABLE `person` ADD CONSTRAINT `FK_company_TO_person_1` FOREIGN KEY (
	`company_id`
)
REFERENCES `company` (
	`id`
);

ALTER TABLE `person` ADD CONSTRAINT `FK_resume_TO_person_1` FOREIGN KEY (
	`resume_id`
)
REFERENCES `resume` (
	`id`
);

ALTER TABLE `content` ADD CONSTRAINT `FK_article_TO_content_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `content` ADD CONSTRAINT `FK_avatar_TO_content_1` FOREIGN KEY (
	`author_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `content` ADD CONSTRAINT `FK_avatar_TO_content_2` FOREIGN KEY (
	`last_editor_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `logged_in` ADD CONSTRAINT `FK_user_TO_logged_in_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `activity` ADD CONSTRAINT `FK_avatar_TO_activity_1` FOREIGN KEY (
	`avatar_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `activity` ADD CONSTRAINT `FK_article_TO_activity_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `activity` ADD CONSTRAINT `FK_content_TO_activity_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `recruit` ADD CONSTRAINT `FK_article_TO_recruit_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `recruit` ADD CONSTRAINT `FK_company_TO_recruit_1` FOREIGN KEY (
	`company_id`
)
REFERENCES `company` (
	`id`
);

ALTER TABLE `notification` ADD CONSTRAINT `FK_article_TO_notification_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `notification` ADD CONSTRAINT `FK_avatar_TO_notification_1` FOREIGN KEY (
	`sender_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `notification` ADD CONSTRAINT `FK_avatar_TO_notification_2` FOREIGN KEY (
	`receiver_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `notification` ADD CONSTRAINT `FK_content_TO_notification_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `change_log` ADD CONSTRAINT `FK_article_TO_change_log_1` FOREIGN KEY (
	`article_id`
)
REFERENCES `article` (
	`id`
);

ALTER TABLE `change_log` ADD CONSTRAINT `FK_avatar_TO_change_log_1` FOREIGN KEY (
	`avatar_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `change_log` ADD CONSTRAINT `FK_content_TO_change_log_1` FOREIGN KEY (
	`content_id`
)
REFERENCES `content` (
	`id`
);

ALTER TABLE `managed_user` ADD CONSTRAINT `FK_user_TO_managed_user_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `user` (
	`id`
);

ALTER TABLE `follow` ADD CONSTRAINT `FK_avatar_TO_follow_1` FOREIGN KEY (
	`follower_id`
)
REFERENCES `avatar` (
	`id`
);

ALTER TABLE `follow` ADD CONSTRAINT `FK_avatar_TO_follow_2` FOREIGN KEY (
	`following_id`
)
REFERENCES `avatar` (
	`id`
);

