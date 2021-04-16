CREATE TABLE `g5_write_qa` (
	`wr_id`	int(11)	NOT NULL,
	`wr_num`	int(11)	NOT NULL	DEFAULT '0',
	`wr_reply`	varchar(10)	NOT NULL,
	`wr_parent`	int(11)	NOT NULL	DEFAULT '0',
	`wr_is_comment`	tinyint(4)	NOT NULL	COMMENT '0',
	`wr_comment`	int(11)	NOT NULL	COMMENT '0',
	`wr_comment_reply`	varchar(5)	NOT NULL,
	`ca_name`	varchar(255)	NOT NULL,
	`wr_option`	set('html1','html2','secret','mail')	NOT NULL,
	`wr_subject`	varchar(255)	NOT NULL,
	`wr_content`	text	NOT NULL,
	`wr_link1`	text	NOT NULL,
	`wr_link2`	text	NOT NULL,
	`wr_link1_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_link2_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_good`	int(11)	NOT NULL	DEFAULT '0',
	`wr_nogood`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL,
	`wr_password`	varchar(255)	NOT NULL,
	`wr_name`	varchar(255)	NOT NULL,
	`wr_email`	varchar(255)	NOT NULL,
	`wr_homepage`	varchar(255)	NOT NULL,
	`wr_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`wr_file`	tinyint(4)	NOT NULL	DEFAULT '0',
	`wr_last`	varchar(19)	NOT NULL,
	`wr_ip`	varchar(255)	NOT NULL,
	`wr_facebook_user`	varchar(255)	NOT NULL,
	`wr_twitter_user`	varchar(255)	NOT NULL,
	`wr_1`	varchar(255)	NOT NULL,
	`wr_2`	varchar(255)	NOT NULL,
	`wr_3`	varchar(255)	NOT NULL,
	`wr_4`	varchar(255)	NOT NULL,
	`wr_5`	varchar(255)	NOT NULL,
	`wr_6`	varchar(255)	NOT NULL,
	`wr_7`	varchar(255)	NOT NULL,
	`wr_8`	varchar(255)	NOT NULL,
	`wr_9`	varchar(255)	NOT NULL,
	`wr_10`	varchar(255)	NOT NULL
);

CREATE TABLE `g5_popular` (
	`pp_id`	int(11)	NOT NULL,
	`pp_word`	varchar(50)	NOT NULL	DEFAULT '',
	`pp_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`pp_ip`	varchar(50)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_sendcost` (
	`sc_id`	int(11)	NOT NULL,
	`sc_name`	varchar(255)	NOT NULL	DEFAULT '',
	`sc_zip1`	varchar(10)	NOT NULL	DEFAULT '',
	`sc_zip2`	varchar(10)	NOT NULL	DEFAULT '',
	`sc_price`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_write_free` (
	`wr_id`	int(11)	NOT NULL,
	`wr_num`	int(11)	NOT NULL	DEFAULT '0',
	`wr_reply`	varchar(10)	NOT NULL,
	`wr_parent`	int(11)	NOT NULL	DEFAULT '0',
	`wr_is_comment`	tinyint(4)	NOT NULL	COMMENT '0',
	`wr_comment`	int(11)	NOT NULL	COMMENT '0',
	`wr_comment_reply`	varchar(5)	NOT NULL,
	`ca_name`	varchar(255)	NOT NULL,
	`wr_option`	set('html1','html2','secret','mail')	NOT NULL,
	`wr_subject`	varchar(255)	NOT NULL,
	`wr_content`	text	NOT NULL,
	`wr_link1`	text	NOT NULL,
	`wr_link2`	text	NOT NULL,
	`wr_link1_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_link2_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_good`	int(11)	NOT NULL	DEFAULT '0',
	`wr_nogood`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL,
	`wr_password`	varchar(255)	NOT NULL,
	`wr_name`	varchar(255)	NOT NULL,
	`wr_email`	varchar(255)	NOT NULL,
	`wr_homepage`	varchar(255)	NOT NULL,
	`wr_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`wr_file`	tinyint(4)	NOT NULL	DEFAULT '0',
	`wr_last`	varchar(19)	NOT NULL,
	`wr_ip`	varchar(255)	NOT NULL,
	`wr_facebook_user`	varchar(255)	NOT NULL,
	`wr_twitter_user`	varchar(255)	NOT NULL,
	`wr_1`	varchar(255)	NOT NULL,
	`wr_2`	varchar(255)	NOT NULL,
	`wr_3`	varchar(255)	NOT NULL,
	`wr_4`	varchar(255)	NOT NULL,
	`wr_5`	varchar(255)	NOT NULL,
	`wr_6`	varchar(255)	NOT NULL,
	`wr_7`	varchar(255)	NOT NULL,
	`wr_8`	varchar(255)	NOT NULL,
	`wr_9`	varchar(255)	NOT NULL,
	`wr_10`	varchar(255)	NOT NULL
);

CREATE TABLE `g5_faq` (
	`fa_id`	int(11)	NOT NULL,
	`fm_id`	int(11)	NOT NULL	DEFAULT '0',
	`fa_subject`	text	NOT NULL,
	`fa_content`	text	NOT NULL,
	`fa_order`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_shop_banner` (
	`bn_id`	int(11)	NOT NULL,
	`bn_alt`	varchar(255)	NOT NULL	DEFAULT '',
	`bn_url`	varchar(255)	NOT NULL	DEFAULT '',
	`bn_device`	varchar(10)	NOT NULL	DEFAULT '',
	`bn_position`	varchar(255)	NOT NULL	DEFAULT '',
	`bn_border`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bn_new_win`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bn_begin_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`bn_end_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`bn_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`bn_hit`	int(11)	NOT NULL	DEFAULT '0',
	`bn_order`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_shop_cart` (
	`ct_id`	int(11)	NOT NULL,
	`od_id`	bigint(20)	NOT NULL,
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`it_name`	varchar(255)	NOT NULL	DEFAULT '',
	`it_sc_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_sc_method`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_sc_price`	int(11)	NOT NULL	DEFAULT '0',
	`it_sc_minimum`	int(11)	NOT NULL	DEFAULT '0',
	`it_sc_qty`	int(11)	NOT NULL	DEFAULT '0',
	`ct_status`	varchar(255)	NOT NULL	DEFAULT '',
	`ct_history`	text	NOT NULL,
	`ct_price`	int(11)	NOT NULL	DEFAULT '0',
	`ct_point`	int(11)	NOT NULL	DEFAULT '0',
	`cp_price`	int(11)	NOT NULL	DEFAULT '0',
	`ct_point_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ct_stock_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ct_option`	varchar(255)	NOT NULL	DEFAULT '',
	`ct_qty`	int(11)	NOT NULL	DEFAULT '0',
	`ct_notax`	tinyint(4)	NOT NULL	DEFAULT '0',
	`io_id`	varchar(255)	NOT NULL	DEFAULT '',
	`io_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`io_price`	int(11)	NOT NULL	DEFAULT '0',
	`ct_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`ct_ip`	varchar(25)	NOT NULL	DEFAULT '',
	`ct_send_cost`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ct_direct`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ct_select`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ct_select_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_event` (
	`ev_id`	int(11)	NOT NULL,
	`ev_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`ev_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`ev_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`ev_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`ev_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`ev_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`ev_mobile_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`ev_mobile_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`ev_mobile_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`ev_mobile_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`ev_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`ev_subject_strong`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ev_head_html`	text	NOT NULL,
	`ev_tail_html`	text	NOT NULL,
	`ev_use`	tinyint(4)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_menu` (
	`me_id`	int(11)	NOT NULL,
	`me_code`	varchar(255)	NOT NULL	DEFAULT '',
	`me_name`	varchar(255)	NOT NULL	DEFAULT '',
	`me_link`	varchar(255)	NOT NULL	DEFAULT '',
	`me_target`	varchar(255)	NOT NULL	DEFAULT '',
	`me_order`	int(11)	NOT NULL	DEFAULT '0',
	`me_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`me_mobile_use`	tinyint(4)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_board_good` (
	`bg_id`	int(11)	NOT NULL,
	`bo_table`	varchar(20)	NOT NULL	DEFAULT '',
	`wr_id`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`bg_flag`	varchar(255)	NOT NULL	DEFAULT '',
	`bg_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_default` (
	`de_admin_company_owner`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_name`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_saupja_no`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_tel`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_fax`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_tongsin_no`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_zip`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_company_addr`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_info_name`	varchar(255)	NOT NULL	DEFAULT '',
	`de_admin_info_email`	varchar(255)	NOT NULL	DEFAULT '',
	`de_shop_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_shop_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type1_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_type1_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type1_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_type1_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_type1_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_type1_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_type2_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_type2_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type2_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_type2_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_type2_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_type2_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_type3_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_type3_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type3_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_type3_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_type3_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_type3_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_type4_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_type4_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type4_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_type4_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_type4_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_type4_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_type5_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_type5_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_type5_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_type5_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_type5_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_type5_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type1_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_type1_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_type1_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type1_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type1_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type1_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type2_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_type2_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_type2_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type2_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type2_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type2_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type3_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_type3_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_type3_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type3_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type3_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type3_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type4_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_type4_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_type4_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type4_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type4_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type4_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type5_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_type5_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_type5_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type5_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type5_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_type5_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_rel_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_rel_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_rel_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_rel_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_rel_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_rel_list_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_mobile_rel_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_rel_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_rel_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_rel_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_search_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_search_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_search_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_search_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_search_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_search_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_search_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_search_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_search_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_search_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_listtype_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_listtype_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_listtype_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_listtype_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_listtype_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_listtype_list_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`de_mobile_listtype_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_listtype_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_listtype_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mobile_listtype_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_bank_use`	int(11)	NOT NULL	DEFAULT '0',
	`de_bank_account`	text	NOT NULL,
	`de_card_test`	int(11)	NOT NULL	DEFAULT '0',
	`de_card_use`	int(11)	NOT NULL	DEFAULT '0',
	`de_card_noint_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_card_point`	int(11)	NOT NULL	DEFAULT '0',
	`de_settle_min_point`	int(11)	NOT NULL	DEFAULT '0',
	`de_settle_max_point`	int(11)	NOT NULL	DEFAULT '0',
	`de_settle_point_unit`	int(11)	NOT NULL	DEFAULT '0',
	`de_level_sell`	int(11)	NOT NULL	DEFAULT '0',
	`de_delivery_company`	varchar(255)	NOT NULL	DEFAULT '',
	`de_send_cost_case`	varchar(255)	NOT NULL	DEFAULT '',
	`de_send_cost_limit`	varchar(255)	NOT NULL	DEFAULT '',
	`de_send_cost_list`	varchar(255)	NOT NULL	DEFAULT '',
	`de_hope_date_use`	int(11)	NOT NULL	DEFAULT '0',
	`de_hope_date_after`	int(11)	NOT NULL	DEFAULT '0',
	`de_baesong_content`	text	NOT NULL,
	`de_change_content`	text	NOT NULL,
	`de_point_days`	int(11)	NOT NULL	DEFAULT '0',
	`de_simg_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_simg_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_mimg_width`	int(11)	NOT NULL	DEFAULT '0',
	`de_mimg_height`	int(11)	NOT NULL	DEFAULT '0',
	`de_sms_cont1`	varchar(255)	NOT NULL	DEFAULT '',
	`de_sms_cont2`	varchar(255)	NOT NULL	DEFAULT '',
	`de_sms_cont3`	varchar(255)	NOT NULL	DEFAULT '',
	`de_sms_cont4`	varchar(255)	NOT NULL	DEFAULT '',
	`de_sms_cont5`	varchar(255)	NOT NULL	DEFAULT '',
	`de_sms_use1`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_sms_use2`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_sms_use3`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_sms_use4`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_sms_use5`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_sms_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`de_pg_service`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kcp_mid`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kcp_site_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_inicis_mid`	varchar(255)	NOT NULL	DEFAULT '',
	`de_inicis_admin_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_inicis_sign_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_iche_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_easy_pay_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_samsung_pay_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_item_use_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_item_use_write`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_code_dup_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_cart_keep_term`	int(11)	NOT NULL	DEFAULT '0',
	`de_guest_cart_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_admin_buga_no`	varchar(255)	NOT NULL	DEFAULT '',
	`de_vbank_use`	varchar(255)	NOT NULL	DEFAULT '',
	`de_taxsave_use`	tinyint(4)	NOT NULL,
	`de_guest_privacy`	text	NOT NULL,
	`de_hp_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_escrow_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_tax_flag_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_kakaopay_mid`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kakaopay_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kakaopay_enckey`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kakaopay_hashkey`	varchar(255)	NOT NULL	DEFAULT '',
	`de_kakaopay_cancelpwd`	varchar(255)	NOT NULL	DEFAULT '',
	`de_naverpay_mid`	varchar(255)	NOT NULL	DEFAULT '',
	`de_naverpay_cert_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_naverpay_button_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_naverpay_test`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_naverpay_mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`de_naverpay_sendcost`	varchar(255)	NOT NULL	DEFAULT '',
	`de_member_reg_coupon_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`de_member_reg_coupon_term`	int(11)	NOT NULL	DEFAULT '0',
	`de_member_reg_coupon_price`	int(11)	NOT NULL	DEFAULT '0',
	`de_member_reg_coupon_minimum`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_shop_order_delete` (
	`de_id`	int(11)	NOT NULL,
	`de_key`	varchar(255)	NOT NULL	DEFAULT '',
	`de_data`	longtext	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`de_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`de_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_scrap` (
	`ms_id`	int(11)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`bo_table`	varchar(20)	NOT NULL	DEFAULT '',
	`wr_id`	varchar(15)	NOT NULL	DEFAULT '',
	`ms_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_coupon_log` (
	`cl_id`	int(11)	NOT NULL,
	`cp_id`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`od_id`	bigint(20)	NOT NULL,
	`cp_price`	int(11)	NOT NULL	DEFAULT '0',
	`cl_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_item_qa` (
	`iq_id`	int(11)	NOT NULL,
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_secret`	tinyint(4)	NOT NULL	DEFAULT '0',
	`iq_name`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_email`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_password`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`iq_question`	text	NOT NULL,
	`iq_answer`	text	NOT NULL,
	`iq_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`iq_ip`	varchar(25)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_event_item` (
	`ev_id`	int(11)	NOT NULL	DEFAULT '0',
	`it_id`	varchar(20)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_coupon_zone` (
	`cz_id`	int(11)	NOT NULL,
	`cz_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cz_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`cz_start`	date	NOT NULL	DEFAULT '0000-00-00',
	`cz_end`	date	NOT NULL	DEFAULT '0000-00-00',
	`cz_file`	varchar(255)	NOT NULL	DEFAULT '',
	`cz_period`	int(11)	NOT NULL	DEFAULT '0',
	`cz_point`	int(11)	NOT NULL	DEFAULT '0',
	`cp_method`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cp_target`	varchar(255)	NOT NULL	DEFAULT '',
	`cp_price`	int(11)	NOT NULL	DEFAULT '0',
	`cp_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cp_trunc`	int(11)	NOT NULL	DEFAULT '0',
	`cp_minimum`	int(11)	NOT NULL	DEFAULT '0',
	`cp_maximum`	int(11)	NOT NULL	DEFAULT '0',
	`cz_download`	int(11)	NOT NULL	DEFAULT '0',
	`cz_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_visit_sum` (
	`vs_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`vs_count`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_poll` (
	`po_id`	int(11)	NOT NULL,
	`po_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll1`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll2`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll3`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll4`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll5`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll6`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll7`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll8`	varchar(255)	NOT NULL	DEFAULT '',
	`po_poll9`	varchar(255)	NOT NULL	DEFAULT '',
	`po_cnt1`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt2`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt3`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt4`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt5`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt6`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt7`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt8`	int(11)	NOT NULL	DEFAULT '0',
	`po_cnt9`	int(11)	NOT NULL	DEFAULT '0',
	`po_etc`	varchar(255)	NOT NULL	DEFAULT '',
	`po_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`po_point`	int(11)	NOT NULL	DEFAULT '0',
	`po_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`po_ips`	mediumtext	NOT NULL,
	`mb_ids`	text	NOT NULL
);

CREATE TABLE `g5_write_notice` (
	`wr_id`	int(11)	NOT NULL,
	`wr_num`	int(11)	NOT NULL	DEFAULT '0',
	`wr_reply`	varchar(10)	NOT NULL,
	`wr_parent`	int(11)	NOT NULL	DEFAULT '0',
	`wr_is_comment`	tinyint(4)	NOT NULL	COMMENT '0',
	`wr_comment`	int(11)	NOT NULL	COMMENT '0',
	`wr_comment_reply`	varchar(5)	NOT NULL,
	`ca_name`	varchar(255)	NOT NULL,
	`wr_option`	set('html1','html2','secret','mail')	NOT NULL,
	`wr_subject`	varchar(255)	NOT NULL,
	`wr_content`	text	NOT NULL,
	`wr_link1`	text	NOT NULL,
	`wr_link2`	text	NOT NULL,
	`wr_link1_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_link2_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_hit`	int(11)	NOT NULL	DEFAULT '0',
	`wr_good`	int(11)	NOT NULL	DEFAULT '0',
	`wr_nogood`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL,
	`wr_password`	varchar(255)	NOT NULL,
	`wr_name`	varchar(255)	NOT NULL,
	`wr_email`	varchar(255)	NOT NULL,
	`wr_homepage`	varchar(255)	NOT NULL,
	`wr_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`wr_file`	tinyint(4)	NOT NULL	DEFAULT '0',
	`wr_last`	varchar(19)	NOT NULL,
	`wr_ip`	varchar(255)	NOT NULL,
	`wr_facebook_user`	varchar(255)	NOT NULL,
	`wr_twitter_user`	varchar(255)	NOT NULL,
	`wr_1`	varchar(255)	NOT NULL,
	`wr_2`	varchar(255)	NOT NULL,
	`wr_3`	varchar(255)	NOT NULL,
	`wr_4`	varchar(255)	NOT NULL,
	`wr_5`	varchar(255)	NOT NULL,
	`wr_6`	varchar(255)	NOT NULL,
	`wr_7`	varchar(255)	NOT NULL,
	`wr_8`	varchar(255)	NOT NULL,
	`wr_9`	varchar(255)	NOT NULL,
	`wr_10`	varchar(255)	NOT NULL
);

CREATE TABLE `g5_qa_content` (
	`qa_id`	int(11)	NOT NULL,
	`qa_num`	int(11)	NOT NULL	DEFAULT '0',
	`qa_parent`	int(11)	NOT NULL	DEFAULT '0',
	`qa_related`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`qa_name`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_email`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_category`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_email_recv`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_sms_recv`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_html`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_content`	text	NOT NULL,
	`qa_status`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_file1`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_source1`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_file2`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_source2`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`qa_1`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_2`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_3`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_4`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_5`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_board_file` (
	`wr_id`	int(11)	NOT NULL	DEFAULT '0',
	`bf_no`	int(11)	NOT NULL	DEFAULT '0',
	`bo_table2`	varchar(20)	NOT NULL	DEFAULT '',
	`bf_source`	varchar(255)	NOT NULL	DEFAULT '',
	`bf_file`	varchar(255)	NOT NULL	DEFAULT '',
	`bf_download`	int(11)	NOT NULL,
	`bf_content`	text	NOT NULL,
	`bf_filesize`	int(11)	NOT NULL	DEFAULT '0',
	`bf_width`	int(11)	NOT NULL	DEFAULT '0',
	`bf_height`	smallint(6)	NOT NULL	DEFAULT '0',
	`bf_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bf_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_board` (
	`bo_table`	varchar(20)	NOT NULL	DEFAULT '',
	`gr_id`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_mobile_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_device`	enum('both','pc','mobile')	NOT NULL	DEFAULT 'both',
	`bo_admin`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_list_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_read_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_write_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_reply_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_comment_level`	tinyint(4)	NOT NULL	COMMENT '0',
	`bo_upload_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_download_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_html_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_link_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_count_delete`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_count_modify`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_read_point`	int(11)	NOT NULL	DEFAULT '0',
	`bo_write_point`	int(11)	NOT NULL	DEFAULT '0',
	`bo_comment_point`	int(11)	NOT NULL	COMMENT '0',
	`bo_download_point`	int(11)	NOT NULL	DEFAULT '0',
	`bo_use_category`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_category_list`	text	NOT NULL,
	`bo_use_sideview`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_file_content`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_secret`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_dhtml_editor`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_rss_view`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_good`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_nogood`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_name`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_signature`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_ip_view`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_list_view`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_list_file`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_list_content`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_table_width`	int(11)	NOT NULL	DEFAULT '0',
	`bo_subject_len`	int(11)	NOT NULL	DEFAULT '0',
	`bo_mobile_subject_len`	int(11)	NOT NULL	DEFAULT '0',
	`bo_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`bo_mobile_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`bo_new`	int(11)	NOT NULL	DEFAULT '0',
	`bo_hot`	int(11)	NOT NULL	DEFAULT '0',
	`bo_image_width`	int(11)	NOT NULL	DEFAULT '0',
	`bo_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_include_head`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_include_tail`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_content_head`	text	NOT NULL,
	`bo_mobile_content_head`	text	NOT NULL,
	`bo_content_tail`	text	NOT NULL,
	`bo_mobile_content_tail`	text	NOT NULL,
	`bo_insert_content`	text	NOT NULL,
	`bo_gallery_cols`	int(11)	NOT NULL	DEFAULT '0',
	`bo_gallery_width`	int(11)	NOT NULL	DEFAULT '0',
	`bo_gallery_height`	int(11)	NOT NULL	DEFAULT '0',
	`bo_mobile_gallery_width`	int(11)	NOT NULL	DEFAULT '0',
	`bo_mobile_gallery_height`	int(11)	NOT NULL	DEFAULT '0',
	`bo_upload_size`	int(11)	NOT NULL	DEFAULT '0',
	`bo_reply_order`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_search`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_order`	int(11)	NOT NULL	DEFAULT '0',
	`bo_count_write`	int(11)	NOT NULL	DEFAULT '0',
	`bo_count_comment`	int(11)	NOT NULL	COMMENT '0',
	`bo_write_min`	int(11)	NOT NULL	DEFAULT '0',
	`bo_write_max`	int(11)	NOT NULL	DEFAULT '0',
	`bo_comment_min`	int(11)	NOT NULL	COMMENT '0',
	`bo_comment_max`	int(11)	NOT NULL	COMMENT '0',
	`bo_notice`	text	NOT NULL,
	`bo_upload_count`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_email`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_use_cert`	enum('','cert','adult','hp-cert','hp-adult')	NOT NULL	DEFAULT '',
	`bo_use_sns`	tinyint(4)	NOT NULL	DEFAULT '0',
	`bo_sort_field`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_6_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_7_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_8_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_9_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_10_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_1`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_2`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_3`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_4`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_5`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_6`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_7`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_8`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_9`	varchar(255)	NOT NULL	DEFAULT '',
	`bo_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_content` (
	`co_id`	varchar(20)	NOT NULL	DEFAULT '',
	`co_html`	tinyint(4)	NOT NULL	DEFAULT '0',
	`co_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`co_content`	longtext	NOT NULL,
	`co_mobile_content`	longtext	NOT NULL,
	`co_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`co_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`co_tag_filter_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`co_hit`	int(11)	NOT NULL	DEFAULT '0',
	`co_include_head`	varchar(255)	NOT NULL,
	`co_include_tail`	varchar(255)	NOT NULL
);

CREATE TABLE `g5_qa_config` (
	`qa_title`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_category`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_use_email`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_req_email`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_use_hp`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_req_hp`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_use_sms`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_send_number`	varchar(255)	NOT NULL	DEFAULT '0',
	`qa_admin_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_admin_email`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_use_editor`	tinyint(4)	NOT NULL	DEFAULT '0',
	`qa_subject_len`	int(11)	NOT NULL	DEFAULT '0',
	`qa_mobile_subject_len`	int(11)	NOT NULL	DEFAULT '0',
	`qa_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`qa_mobile_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`qa_image_width`	int(11)	NOT NULL	DEFAULT '0',
	`qa_upload_size`	int(11)	NOT NULL	DEFAULT '0',
	`qa_insert_content`	text	NOT NULL,
	`qa_include_head`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_include_tail`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_content_head`	text	NOT NULL,
	`qa_content_tail`	text	NOT NULL,
	`qa_mobile_content_head`	text	NOT NULL,
	`qa_mobile_content_tail`	text	NOT NULL,
	`qa_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_1`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_2`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_3`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_4`	varchar(255)	NOT NULL	DEFAULT '',
	`qa_5`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_inicis_log` (
	`oid`	bigint(20)	NOT NULL,
	`P_TID`	varchar(255)	NOT NULL	DEFAULT '',
	`P_MID`	varchar(255)	NOT NULL	DEFAULT '',
	`P_AUTH_DT`	varchar(255)	NOT NULL	DEFAULT '',
	`P_STATUS`	varchar(255)	NOT NULL	DEFAULT '',
	`P_TYPE`	varchar(255)	NOT NULL	DEFAULT '',
	`P_OID`	varchar(255)	NOT NULL	DEFAULT '',
	`P_FN_NM`	varchar(255)	NOT NULL	DEFAULT '',
	`P_AUTH_NO`	varchar(255)	NOT NULL	DEFAULT '',
	`P_AMT`	int(11)	NOT NULL	DEFAULT '0',
	`P_RMESG1`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_login` (
	`lo_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`lo_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`lo_location`	text	NOT NULL,
	`lo_url`	text	NOT NULL
);

CREATE TABLE `g5_shop_order_address` (
	`ad_id`	int(11)	NOT NULL,
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_default`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ad_name`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_tel`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_zip1`	char(3)	NOT NULL	DEFAULT '',
	`ad_zip2`	char(3)	NOT NULL	DEFAULT '',
	`ad_addr1`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_addr2`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_addr3`	varchar(255)	NOT NULL	DEFAULT '',
	`ad_jibeon`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_poll_etc` (
	`pc_id`	int(11)	NOT NULL	DEFAULT '0',
	`po_id`	int(11)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`pc_name`	varchar(255)	NOT NULL	DEFAULT '',
	`pc_idea`	varchar(255)	NOT NULL	DEFAULT '',
	`pc_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_item_stocksms` (
	`ss_id`	int(11)	NOT NULL,
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`ss_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`ss_send`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ss_send_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`ss_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`ss_ip`	varchar(25)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_member` (
	`mb_no`	int(11)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`mb_password`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_name`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_nick`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_nick_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`mb_email`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_homepage`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`mb_sex`	char(1)	NOT NULL	DEFAULT '',
	`mb_birth`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_tel`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_certify`	varchar(20)	NOT NULL	DEFAULT '',
	`mb_adult`	tinyint(4)	NOT NULL	DEFAULT '0',
	`mb_dupinfo`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_zip1`	char(3)	NOT NULL	DEFAULT '',
	`mb_zip2`	char(3)	NOT NULL	DEFAULT '',
	`mb_addr1`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_addr2`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_addr3`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_addr_jibeon`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_signature`	text	NOT NULL,
	`mb_recommend`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_point`	int(11)	NOT NULL	DEFAULT '0',
	`mb_today_login`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`mb_login_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`mb_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_leave_date`	varchar(8)	NOT NULL	DEFAULT '',
	`mb_intercept_date`	varchar(8)	NOT NULL	DEFAULT '',
	`mb_email_certify`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`mb_email_certify2`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_memo`	text	NOT NULL,
	`mb_lost_certify`	varchar(255)	NOT NULL,
	`mb_mailling`	tinyint(4)	NOT NULL	DEFAULT '0',
	`mb_sms`	tinyint(4)	NOT NULL	DEFAULT '0',
	`mb_open`	tinyint(4)	NOT NULL	DEFAULT '0',
	`mb_open_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`mb_profile`	text	NOT NULL,
	`mb_memo_call`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_1`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_2`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_3`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_4`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_5`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_6`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_7`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_8`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_9`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_item` (
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`ca_id`	varchar(10)	NOT NULL	DEFAULT '0',
	`ca_id2`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_id3`	varchar(255)	NOT NULL	DEFAULT '',
	`it_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`it_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`it_name`	varchar(255)	NOT NULL	DEFAULT '',
	`it_maker`	varchar(255)	NOT NULL	DEFAULT '',
	`it_origin`	varchar(255)	NOT NULL	DEFAULT '',
	`it_brand`	varchar(255)	NOT NULL	DEFAULT '',
	`it_model`	varchar(255)	NOT NULL	DEFAULT '',
	`it_option_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`it_supply_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`it_type1`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_type2`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_type3`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_type4`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_type5`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_basic`	text	NOT NULL,
	`it_explan`	mediumtext	NOT NULL,
	`it_explan2`	mediumtext	NOT NULL,
	`it_mobile_explan`	mediumtext	NOT NULL,
	`it_cust_price`	int(11)	NOT NULL	DEFAULT '0',
	`it_price`	int(11)	NOT NULL	DEFAULT '0',
	`it_point`	int(11)	NOT NULL	DEFAULT '0',
	`it_point_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_supply_point`	int(11)	NOT NULL	DEFAULT '0',
	`it_notax`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_sell_email`	varchar(255)	NOT NULL	DEFAULT '',
	`it_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_nocoupon`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_soldout`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_stock_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_stock_sms`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_noti_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_sc_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_sc_method`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_sc_price`	int(11)	NOT NULL	DEFAULT '0',
	`it_sc_minimum`	int(11)	NOT NULL	DEFAULT '0',
	`it_sc_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_buy_min_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_buy_max_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_head_html`	text	NOT NULL,
	`it_tail_html`	text	NOT NULL,
	`it_mobile_head_html`	text	NOT NULL,
	`it_mobile_tail_html`	text	NOT NULL,
	`it_hit`	int(11)	NOT NULL	DEFAULT '0',
	`it_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`it_update_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`it_ip`	varchar(25)	NOT NULL	DEFAULT '',
	`it_order`	int(11)	NOT NULL	DEFAULT '0',
	`it_tel_inq`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_info_gubun`	varchar(50)	NOT NULL	DEFAULT '',
	`it_info_value`	text	NOT NULL,
	`it_sum_qty`	int(11)	NOT NULL	DEFAULT '0',
	`it_use_cnt`	int(11)	NOT NULL	DEFAULT '0',
	`it_use_avg`	decimal(2,1)	NOT NULL,
	`it_shop_memo`	text	NOT NULL,
	`ec_mall_pid`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img1`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img2`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img3`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img4`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img5`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img6`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img7`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img8`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img9`	varchar(255)	NOT NULL	DEFAULT '',
	`it_img10`	varchar(255)	NOT NULL	DEFAULT '',
	`it_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_6_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_7_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_8_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_9_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_10_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`it_1`	varchar(255)	NOT NULL	DEFAULT '',
	`it_2`	varchar(255)	NOT NULL	DEFAULT '',
	`it_3`	varchar(255)	NOT NULL	DEFAULT '',
	`it_4`	varchar(255)	NOT NULL	DEFAULT '',
	`it_5`	varchar(255)	NOT NULL	DEFAULT '',
	`it_6`	varchar(255)	NOT NULL	DEFAULT '',
	`it_7`	varchar(255)	NOT NULL	DEFAULT '',
	`it_8`	varchar(255)	NOT NULL	DEFAULT '',
	`it_9`	varchar(255)	NOT NULL	DEFAULT '',
	`it_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_group_member` (
	`gm_id`	int(11)	NOT NULL,
	`gr_id`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`gm_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_shop_item_use` (
	`is_id`	int(11)	NOT NULL,
	`it_id`	varchar(20)	NOT NULL	DEFAULT '0',
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`is_name`	varchar(255)	NOT NULL	DEFAULT '',
	`is_password`	varchar(255)	NOT NULL	DEFAULT '',
	`is_score`	tinyint(4)	NOT NULL	DEFAULT '0',
	`is_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`is_content`	text	NOT NULL,
	`is_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`is_ip`	varchar(25)	NOT NULL	DEFAULT '',
	`is_confirm`	tinyint(4)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_cert_history` (
	`cr_id`	int(11)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`cr_company`	varchar(255)	NOT NULL	DEFAULT '',
	`cr_method`	varchar(255)	NOT NULL	DEFAULT '',
	`cr_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`cr_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`cr_time`	time	NOT NULL	DEFAULT '00:00:00'
);

CREATE TABLE `g5_auth` (
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`au_menu`	varchar(20)	NOT NULL	DEFAULT '',
	`au_auth`	set('r','w','d')	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_item_option` (
	`io_no`	int(11)	NOT NULL,
	`io_id`	varchar(255)	NOT NULL	DEFAULT '0',
	`io_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`io_price`	int(11)	NOT NULL	DEFAULT '0',
	`io_stock_qty`	int(11)	NOT NULL	DEFAULT '0',
	`io_noti_qty`	int(11)	NOT NULL	DEFAULT '0',
	`io_use`	tinyint(4)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_shop_item_relation` (
	`it_id2`	varchar(20)	NOT NULL	DEFAULT '',
	`it_id`	varchar(20)	NOT NULL	DEFAULT '',
	`ir_no`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_config` (
	`cf_title`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_theme`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_admin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_admin_email`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_admin_email_name`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_add_script`	text	NOT NULL,
	`cf_use_point`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_point_term`	int(11)	NOT NULL	DEFAULT '0',
	`cf_use_copy_log`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_email_certify`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_login_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_cut_name`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_nick_modify`	int(11)	NOT NULL	DEFAULT '0',
	`cf_new_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_new_rows`	int(11)	NOT NULL	DEFAULT '0',
	`cf_search_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_connect_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_faq_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_read_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_write_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_comment_point`	int(11)	NOT NULL	COMMENT '0',
	`cf_download_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_write_pages`	int(11)	NOT NULL	DEFAULT '0',
	`cf_mobile_pages`	int(11)	NOT NULL	DEFAULT '0',
	`cf_link_target`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_delay_sec`	int(11)	NOT NULL	DEFAULT '0',
	`cf_filter`	text	NOT NULL,
	`cf_possible_ip`	text	NOT NULL,
	`cf_intercept_ip`	text	NOT NULL,
	`cf_analytics`	text	NOT NULL,
	`cf_add_meta`	text	NOT NULL,
	`cf_member_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_use_homepage`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_homepage`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_tel`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_tel`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_hp`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_hp`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_addr`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_addr`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_signature`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_signature`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_profile`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_req_profile`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_register_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_register_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_icon_level`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_use_recommend`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_recommend_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_leave_day`	int(11)	NOT NULL	DEFAULT '0',
	`cf_search_part`	int(11)	NOT NULL	DEFAULT '0',
	`cf_email_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_wr_super_admin`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_wr_group_admin`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_wr_board_admin`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_wr_write`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_wr_comment_all`	tinyint(4)	NOT NULL	COMMENT '0',
	`cf_email_mb_super_admin`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_mb_member`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_email_po_super_admin`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_prohibit_id`	text	NOT NULL,
	`cf_prohibit_email`	text	NOT NULL,
	`cf_new_del`	int(11)	NOT NULL	DEFAULT '0',
	`cf_memo_del`	int(11)	NOT NULL	DEFAULT '0',
	`cf_visit_del`	int(11)	NOT NULL	DEFAULT '0',
	`cf_popular_del`	int(11)	NOT NULL	DEFAULT '0',
	`cf_optimize_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`cf_use_member_icon`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_member_icon_size`	int(11)	NOT NULL	DEFAULT '0',
	`cf_member_icon_width`	int(11)	NOT NULL	DEFAULT '0',
	`cf_member_icon_height`	int(11)	NOT NULL	DEFAULT '0',
	`cf_login_minutes`	int(11)	NOT NULL	DEFAULT '0',
	`cf_image_extension`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_flash_extension`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_movie_extension`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_formmail_is_member`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`cf_mobile_page_rows`	int(11)	NOT NULL	DEFAULT '0',
	`cf_visit`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_max_po_id`	int(11)	NOT NULL	DEFAULT '0',
	`cf_stipulation`	text	NOT NULL,
	`cf_privacy`	text	NOT NULL,
	`cf_open_modify`	int(11)	NOT NULL	DEFAULT '0',
	`cf_memo_send_point`	int(11)	NOT NULL	DEFAULT '0',
	`cf_mobile_new_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_mobile_search_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_mobile_connect_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_mobile_faq_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_mobile_member_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_captcha_mp3`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_editor`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_cert_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_cert_ipin`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_cert_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_cert_kcb_cd`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_cert_kcp_cd`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_lg_mid`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_lg_mert_key`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_cert_limit`	int(11)	NOT NULL	DEFAULT '0',
	`cf_cert_req`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cf_sms_use`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_sms_type`	varchar(10)	NOT NULL	DEFAULT '',
	`cf_icode_id`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_icode_pw`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_icode_server_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_icode_server_port`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_googl_shorturl_apikey`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_facebook_appid`	varchar(255)	NOT NULL,
	`cf_facebook_secret`	varchar(255)	NOT NULL,
	`cf_twitter_key`	varchar(255)	NOT NULL,
	`cf_twitter_secret`	varchar(255)	NOT NULL,
	`cf_kakao_js_apikey`	varchar(255)	NOT NULL,
	`cf_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_6_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_7_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_8_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_9_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_10_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_1`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_2`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_3`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_4`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_5`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_6`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_7`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_8`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_9`	varchar(255)	NOT NULL	DEFAULT '',
	`cf_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_autosave` (
	`as_id`	int(11)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL,
	`as_uid`	bigint(20)	NOT NULL,
	`as_subject`	varchar(255)	NOT NULL,
	`as_content`	text	NOT NULL,
	`as_datetime`	datetime	NOT NULL
);

CREATE TABLE `g5_memo` (
	`me_id`	int(11)	NOT NULL	DEFAULT '0',
	`me_recv_mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`me_send_mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`me_send_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`me_read_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`me_memo`	text	NOT NULL
);

CREATE TABLE `g5_shop_category` (
	`ca_id`	varchar(10)	NOT NULL	DEFAULT '0',
	`ca_name`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_order`	int(11)	NOT NULL	DEFAULT '0',
	`ca_skin_dir`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_mobile_skin_dir`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_mobile_skin`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`ca_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`ca_mobile_img_width`	int(11)	NOT NULL	DEFAULT '0',
	`ca_mobile_img_height`	int(11)	NOT NULL	DEFAULT '0',
	`ca_sell_email`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ca_stock_qty`	int(11)	NOT NULL	DEFAULT '0',
	`ca_explan_html`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ca_head_html`	text	NOT NULL,
	`ca_tail_html`	text	NOT NULL,
	`ca_mobile_head_html`	text	NOT NULL,
	`ca_mobile_tail_html`	text	NOT NULL,
	`ca_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`ca_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`ca_mobile_list_mod`	int(11)	NOT NULL	DEFAULT '0',
	`ca_mobile_list_row`	int(11)	NOT NULL	DEFAULT '0',
	`ca_include_head`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_include_tail`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_cert_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ca_adult_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ca_nocoupon`	tinyint(4)	NOT NULL	DEFAULT '0',
	`ca_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_6_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_7_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_8_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_9_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_10_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_1`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_2`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_3`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_4`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_5`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_6`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_7`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_8`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_9`	varchar(255)	NOT NULL	DEFAULT '',
	`ca_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_wish` (
	`wi_id`	int(11)	NOT NULL,
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`it_id`	varchar(20)	NOT NULL	DEFAULT '0',
	`wi_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`wi_ip`	varchar(25)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_coupon` (
	`cp_no`	int(11)	NOT NULL,
	`cp_id`	varchar(255)	NOT NULL	DEFAULT '',
	`cp_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`cp_method`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cp_target`	varchar(255)	NOT NULL	DEFAULT '',
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`cz_id`	int(11)	NOT NULL	DEFAULT '0',
	`cp_start`	date	NOT NULL	DEFAULT '0000-00-00',
	`cp_end`	date	NOT NULL	DEFAULT '0000-00-00',
	`cp_price`	int(11)	NOT NULL	DEFAULT '0',
	`cp_type`	tinyint(4)	NOT NULL	DEFAULT '0',
	`cp_trunc`	int(11)	NOT NULL	DEFAULT '0',
	`cp_minimum`	int(11)	NOT NULL	DEFAULT '0',
	`cp_maximum`	int(11)	NOT NULL	DEFAULT '0',
	`od_id`	bigint(20)	NOT NULL,
	`cp_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_point` (
	`po_id`	int(11)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`po_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`po_content`	varchar(255)	NOT NULL	DEFAULT '',
	`po_point`	int(11)	NOT NULL	DEFAULT '0',
	`po_use_point`	int(11)	NOT NULL	DEFAULT '0',
	`po_expired`	tinyint(4)	NOT NULL	DEFAULT '0',
	`po_expire_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`po_mb_point`	int(11)	NOT NULL	DEFAULT '0',
	`po_rel_table`	varchar(20)	NOT NULL	DEFAULT '',
	`po_rel_id`	varchar(20)	NOT NULL	DEFAULT '',
	`po_rel_action`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_group` (
	`gr_id`	varchar(10)	NOT NULL	DEFAULT '',
	`gr_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_device`	enum('both','pc','mobile')	NOT NULL	DEFAULT 'both',
	`gr_admin`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_use_access`	tinyint(4)	NOT NULL	DEFAULT '0',
	`gr_order`	int(11)	NOT NULL	DEFAULT '0',
	`gr_1_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_2_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_3_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_4_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_5_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_6_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_7_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_8_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_9_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_10_subj`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_1`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_2`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_3`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_4`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_5`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_6`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_7`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_8`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_9`	varchar(255)	NOT NULL	DEFAULT '',
	`gr_10`	varchar(255)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_board_new` (
	`bn_id`	int(11)	NOT NULL,
	`bo_table`	varchar(20)	NOT NULL	DEFAULT '',
	`wr_id`	int(11)	NOT NULL	DEFAULT '0',
	`wr_parent`	int(11)	NOT NULL	DEFAULT '0',
	`bn_datetime`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`mb_id`	varchar(20)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_faq_master` (
	`fm_id`	int(11)	NOT NULL,
	`fm_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`fm_head_html`	text	NOT NULL,
	`fm_tail_html`	text	NOT NULL,
	`fm_mobile_head_html`	text	NOT NULL,
	`fm_mobile_tail_html`	text	NOT NULL,
	`fm_order`	int(11)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_uniqid` (
	`uq_id`	bigint(20)	NOT NULL,
	`uq_ip`	varchar(255)	NOT NULL
);

CREATE TABLE `g5_shop_order` (
	`od_id`	bigint(20)	NOT NULL,
	`mb_id`	varchar(255)	NOT NULL	DEFAULT '',
	`od_name`	varchar(20)	NOT NULL	DEFAULT '',
	`od_email`	varchar(100)	NOT NULL	DEFAULT '',
	`od_tel`	varchar(20)	NOT NULL	DEFAULT '',
	`od_hp`	varchar(20)	NOT NULL	DEFAULT '',
	`od_zip1`	char(3)	NOT NULL	DEFAULT '',
	`od_zip2`	char(3)	NOT NULL	DEFAULT '',
	`od_addr1`	varchar(100)	NOT NULL	DEFAULT '',
	`od_addr2`	varchar(100)	NOT NULL	DEFAULT '',
	`od_addr3`	varchar(255)	NOT NULL	DEFAULT '',
	`od_addr_jibeon`	varchar(255)	NOT NULL	DEFAULT '',
	`od_deposit_name`	varchar(20)	NOT NULL	DEFAULT '',
	`od_b_name`	varchar(20)	NOT NULL	DEFAULT '',
	`od_b_tel`	varchar(20)	NOT NULL	DEFAULT '',
	`od_b_hp`	varchar(20)	NOT NULL	DEFAULT '',
	`od_b_zip1`	char(3)	NOT NULL	DEFAULT '',
	`od_b_zip2`	char(3)	NOT NULL	DEFAULT '',
	`od_b_addr1`	varchar(100)	NOT NULL	DEFAULT '',
	`od_b_addr2`	varchar(100)	NOT NULL	DEFAULT '',
	`od_b_addr3`	varchar(255)	NOT NULL	DEFAULT '',
	`od_b_addr_jibeon`	varchar(255)	NOT NULL	DEFAULT '',
	`od_memo`	text	NOT NULL,
	`od_cart_count`	int(11)	NOT NULL	DEFAULT '0',
	`od_cart_price`	int(11)	NOT NULL	DEFAULT '0',
	`od_cart_coupon`	int(11)	NOT NULL	DEFAULT '0',
	`od_send_cost`	int(11)	NOT NULL	DEFAULT '0',
	`od_send_cost2`	int(11)	NOT NULL	DEFAULT '0',
	`od_send_coupon`	int(11)	NOT NULL	DEFAULT '0',
	`od_receipt_price`	int(11)	NOT NULL	DEFAULT '0',
	`od_cancel_price`	int(11)	NOT NULL	DEFAULT '0',
	`od_receipt_point`	int(11)	NOT NULL	DEFAULT '0',
	`od_refund_price`	int(11)	NOT NULL	DEFAULT '0',
	`od_bank_account`	varchar(255)	NOT NULL	DEFAULT '',
	`od_receipt_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`od_coupon`	int(11)	NOT NULL	DEFAULT '0',
	`od_misu`	int(11)	NOT NULL	DEFAULT '0',
	`od_shop_memo`	text	NOT NULL,
	`od_mod_history`	text	NOT NULL,
	`od_status`	varchar(255)	NOT NULL	DEFAULT '',
	`od_hope_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`od_settle_case`	varchar(255)	NOT NULL	DEFAULT '',
	`od_test`	tinyint(4)	NOT NULL	DEFAULT '0',
	`od_mobile`	tinyint(4)	NOT NULL	DEFAULT '0',
	`od_pg`	varchar(255)	NOT NULL	DEFAULT '',
	`od_tno`	varchar(255)	NOT NULL	DEFAULT '',
	`od_app_no`	varchar(20)	NOT NULL	DEFAULT '',
	`od_escrow`	tinyint(4)	NOT NULL	DEFAULT '0',
	`od_casseqno`	varchar(255)	NOT NULL	DEFAULT '',
	`od_tax_flag`	tinyint(4)	NOT NULL	DEFAULT '0',
	`od_tax_mny`	int(11)	NOT NULL	DEFAULT '0',
	`od_vat_mny`	int(11)	NOT NULL	DEFAULT '0',
	`od_free_mny`	int(11)	NOT NULL	DEFAULT '0',
	`od_delivery_company`	varchar(255)	NOT NULL	DEFAULT '0',
	`od_invoice`	varchar(255)	NOT NULL	DEFAULT '',
	`od_invoice_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`od_cash`	tinyint(4)	NOT NULL,
	`od_cash_no`	varchar(255)	NOT NULL,
	`od_cash_info`	text	NOT NULL,
	`od_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`od_pwd`	varchar(255)	NOT NULL	DEFAULT '',
	`od_ip`	varchar(25)	NOT NULL	DEFAULT ''
);

CREATE TABLE `g5_shop_personalpay` (
	`pp_id`	bigint(20)	NOT NULL,
	`od_id`	bigint(20)	NOT NULL,
	`pp_name`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_email`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_hp`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_content`	text	NOT NULL,
	`pp_use`	tinyint(4)	NOT NULL	DEFAULT '0',
	`pp_price`	int(11)	NOT NULL	DEFAULT '0',
	`pp_pg`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_tno`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_app_no`	varchar(20)	NOT NULL	DEFAULT '',
	`pp_casseqno`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_receipt_price`	int(11)	NOT NULL	DEFAULT '0',
	`pp_settle_case`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_bank_account`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_deposit_name`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_receipt_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`pp_receipt_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_shop_memo`	text	NOT NULL,
	`pp_cash`	tinyint(4)	NOT NULL	DEFAULT '0',
	`pp_cash_no`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_cash_info`	text	NOT NULL,
	`pp_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`pp_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_mail` (
	`ma_id`	int(11)	NOT NULL,
	`ma_subject`	varchar(255)	NOT NULL	DEFAULT '',
	`ma_content`	mediumtext	NOT NULL,
	`ma_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`ma_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`ma_last_option`	text	NOT NULL
);

CREATE TABLE `g5_new_win` (
	`nw_id`	int(11)	NOT NULL,
	`nw_division`	varchar(10)	NOT NULL	DEFAULT 'both',
	`nw_device`	varchar(10)	NOT NULL	DEFAULT 'both',
	`nw_begin_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`nw_end_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00',
	`nw_disable_hours`	int(11)	NOT NULL	DEFAULT '0',
	`nw_left`	int(11)	NOT NULL	DEFAULT '0',
	`nw_top`	int(11)	NOT NULL	DEFAULT '0',
	`nw_height`	int(11)	NOT NULL	DEFAULT '0',
	`nw_width`	int(11)	NOT NULL	DEFAULT '0',
	`nw_subject`	text	NOT NULL,
	`nw_content`	text	NOT NULL,
	`nw_content_html`	tinyint(4)	NOT NULL	DEFAULT '0'
);

CREATE TABLE `g5_shop_order_data` (
	`od_id`	bigint(20)	NOT NULL,
	`cart_id`	bigint(20)	NOT NULL,
	`mb_id`	varchar(20)	NOT NULL	DEFAULT '',
	`dt_pg`	varchar(255)	NOT NULL	DEFAULT '',
	`dt_data`	text	NOT NULL,
	`dt_time`	datetime	NOT NULL	DEFAULT '0000-00-00 00:00:00'
);

CREATE TABLE `g5_visit` (
	`vi_id`	int(11)	NOT NULL	DEFAULT '0',
	`vi_ip`	varchar(255)	NOT NULL	DEFAULT '',
	`vi_date`	date	NOT NULL	DEFAULT '0000-00-00',
	`vi_time`	time	NOT NULL	DEFAULT '00:00:00',
	`vi_referer`	text	NOT NULL,
	`vi_agent`	varchar(255)	NOT NULL	DEFAULT ''
);

ALTER TABLE `g5_write_qa` ADD CONSTRAINT `PK_G5_WRITE_QA` PRIMARY KEY (
	`wr_id`
);

ALTER TABLE `g5_popular` ADD CONSTRAINT `PK_G5_POPULAR` PRIMARY KEY (
	`pp_id`
);

ALTER TABLE `g5_shop_sendcost` ADD CONSTRAINT `PK_G5_SHOP_SENDCOST` PRIMARY KEY (
	`sc_id`
);

ALTER TABLE `g5_write_free` ADD CONSTRAINT `PK_G5_WRITE_FREE` PRIMARY KEY (
	`wr_id`
);

ALTER TABLE `g5_faq` ADD CONSTRAINT `PK_G5_FAQ` PRIMARY KEY (
	`fa_id`
);

ALTER TABLE `g5_shop_banner` ADD CONSTRAINT `PK_G5_SHOP_BANNER` PRIMARY KEY (
	`bn_id`
);

ALTER TABLE `g5_shop_cart` ADD CONSTRAINT `PK_G5_SHOP_CART` PRIMARY KEY (
	`ct_id`
);

ALTER TABLE `g5_shop_event` ADD CONSTRAINT `PK_G5_SHOP_EVENT` PRIMARY KEY (
	`ev_id`
);

ALTER TABLE `g5_menu` ADD CONSTRAINT `PK_G5_MENU` PRIMARY KEY (
	`me_id`
);

ALTER TABLE `g5_board_good` ADD CONSTRAINT `PK_G5_BOARD_GOOD` PRIMARY KEY (
	`bg_id`
);

ALTER TABLE `g5_shop_order_delete` ADD CONSTRAINT `PK_G5_SHOP_ORDER_DELETE` PRIMARY KEY (
	`de_id`
);

ALTER TABLE `g5_scrap` ADD CONSTRAINT `PK_G5_SCRAP` PRIMARY KEY (
	`ms_id`
);

ALTER TABLE `g5_shop_coupon_log` ADD CONSTRAINT `PK_G5_SHOP_COUPON_LOG` PRIMARY KEY (
	`cl_id`
);

ALTER TABLE `g5_shop_item_qa` ADD CONSTRAINT `PK_G5_SHOP_ITEM_QA` PRIMARY KEY (
	`iq_id`
);

ALTER TABLE `g5_shop_event_item` ADD CONSTRAINT `PK_G5_SHOP_EVENT_ITEM` PRIMARY KEY (
	`ev_id`,
	`it_id`
);

ALTER TABLE `g5_shop_coupon_zone` ADD CONSTRAINT `PK_G5_SHOP_COUPON_ZONE` PRIMARY KEY (
	`cz_id`
);

ALTER TABLE `g5_visit_sum` ADD CONSTRAINT `PK_G5_VISIT_SUM` PRIMARY KEY (
	`vs_date`
);

ALTER TABLE `g5_poll` ADD CONSTRAINT `PK_G5_POLL` PRIMARY KEY (
	`po_id`
);

ALTER TABLE `g5_write_notice` ADD CONSTRAINT `PK_G5_WRITE_NOTICE` PRIMARY KEY (
	`wr_id`
);

ALTER TABLE `g5_qa_content` ADD CONSTRAINT `PK_G5_QA_CONTENT` PRIMARY KEY (
	`qa_id`
);

ALTER TABLE `g5_board_file` ADD CONSTRAINT `PK_G5_BOARD_FILE` PRIMARY KEY (
	`wr_id`,
	`bf_no`,
	`bo_table2`
);

ALTER TABLE `g5_board` ADD CONSTRAINT `PK_G5_BOARD` PRIMARY KEY (
	`bo_table`
);

ALTER TABLE `g5_content` ADD CONSTRAINT `PK_G5_CONTENT` PRIMARY KEY (
	`co_id`
);

ALTER TABLE `g5_shop_inicis_log` ADD CONSTRAINT `PK_G5_SHOP_INICIS_LOG` PRIMARY KEY (
	`oid`
);

ALTER TABLE `g5_login` ADD CONSTRAINT `PK_G5_LOGIN` PRIMARY KEY (
	`lo_ip`
);

ALTER TABLE `g5_shop_order_address` ADD CONSTRAINT `PK_G5_SHOP_ORDER_ADDRESS` PRIMARY KEY (
	`ad_id`
);

ALTER TABLE `g5_poll_etc` ADD CONSTRAINT `PK_G5_POLL_ETC` PRIMARY KEY (
	`pc_id`
);

ALTER TABLE `g5_shop_item_stocksms` ADD CONSTRAINT `PK_G5_SHOP_ITEM_STOCKSMS` PRIMARY KEY (
	`ss_id`
);

ALTER TABLE `g5_member` ADD CONSTRAINT `PK_G5_MEMBER` PRIMARY KEY (
	`mb_no`
);

ALTER TABLE `g5_shop_item` ADD CONSTRAINT `PK_G5_SHOP_ITEM` PRIMARY KEY (
	`it_id`
);

ALTER TABLE `g5_group_member` ADD CONSTRAINT `PK_G5_GROUP_MEMBER` PRIMARY KEY (
	`gm_id`
);

ALTER TABLE `g5_shop_item_use` ADD CONSTRAINT `PK_G5_SHOP_ITEM_USE` PRIMARY KEY (
	`is_id`
);

ALTER TABLE `g5_cert_history` ADD CONSTRAINT `PK_G5_CERT_HISTORY` PRIMARY KEY (
	`cr_id`
);

ALTER TABLE `g5_auth` ADD CONSTRAINT `PK_G5_AUTH` PRIMARY KEY (
	`mb_id`,
	`au_menu`
);

ALTER TABLE `g5_shop_item_option` ADD CONSTRAINT `PK_G5_SHOP_ITEM_OPTION` PRIMARY KEY (
	`io_no`
);

ALTER TABLE `g5_shop_item_relation` ADD CONSTRAINT `PK_G5_SHOP_ITEM_RELATION` PRIMARY KEY (
	`it_id2`,
	`it_id`
);

ALTER TABLE `g5_autosave` ADD CONSTRAINT `PK_G5_AUTOSAVE` PRIMARY KEY (
	`as_id`
);

ALTER TABLE `g5_memo` ADD CONSTRAINT `PK_G5_MEMO` PRIMARY KEY (
	`me_id`
);

ALTER TABLE `g5_shop_category` ADD CONSTRAINT `PK_G5_SHOP_CATEGORY` PRIMARY KEY (
	`ca_id`
);

ALTER TABLE `g5_shop_wish` ADD CONSTRAINT `PK_G5_SHOP_WISH` PRIMARY KEY (
	`wi_id`
);

ALTER TABLE `g5_shop_coupon` ADD CONSTRAINT `PK_G5_SHOP_COUPON` PRIMARY KEY (
	`cp_no`
);

ALTER TABLE `g5_point` ADD CONSTRAINT `PK_G5_POINT` PRIMARY KEY (
	`po_id`
);

ALTER TABLE `g5_group` ADD CONSTRAINT `PK_G5_GROUP` PRIMARY KEY (
	`gr_id`
);

ALTER TABLE `g5_board_new` ADD CONSTRAINT `PK_G5_BOARD_NEW` PRIMARY KEY (
	`bn_id`
);

ALTER TABLE `g5_faq_master` ADD CONSTRAINT `PK_G5_FAQ_MASTER` PRIMARY KEY (
	`fm_id`
);

ALTER TABLE `g5_uniqid` ADD CONSTRAINT `PK_G5_UNIQID` PRIMARY KEY (
	`uq_id`
);

ALTER TABLE `g5_shop_order` ADD CONSTRAINT `PK_G5_SHOP_ORDER` PRIMARY KEY (
	`od_id`
);

ALTER TABLE `g5_shop_personalpay` ADD CONSTRAINT `PK_G5_SHOP_PERSONALPAY` PRIMARY KEY (
	`pp_id`
);

ALTER TABLE `g5_mail` ADD CONSTRAINT `PK_G5_MAIL` PRIMARY KEY (
	`ma_id`
);

ALTER TABLE `g5_new_win` ADD CONSTRAINT `PK_G5_NEW_WIN` PRIMARY KEY (
	`nw_id`
);

ALTER TABLE `g5_visit` ADD CONSTRAINT `PK_G5_VISIT` PRIMARY KEY (
	`vi_id`
);

ALTER TABLE `g5_faq` ADD CONSTRAINT `FK_g5_faq_master_TO_g5_faq_1` FOREIGN KEY (
	`fm_id`
)
REFERENCES `g5_faq_master` (
	`fm_id`
);

ALTER TABLE `g5_shop_cart` ADD CONSTRAINT `FK_g5_shop_order_TO_g5_shop_cart_1` FOREIGN KEY (
	`od_id`
)
REFERENCES `g5_shop_order` (
	`od_id`
);

ALTER TABLE `g5_shop_cart` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_cart_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_board_good` ADD CONSTRAINT `FK_g5_board_TO_g5_board_good_1` FOREIGN KEY (
	`bo_table`
)
REFERENCES `g5_board` (
	`bo_table`
);

ALTER TABLE `g5_scrap` ADD CONSTRAINT `FK_g5_board_TO_g5_scrap_1` FOREIGN KEY (
	`bo_table`
)
REFERENCES `g5_board` (
	`bo_table`
);

ALTER TABLE `g5_shop_coupon_log` ADD CONSTRAINT `FK_g5_shop_order_TO_g5_shop_coupon_log_1` FOREIGN KEY (
	`od_id`
)
REFERENCES `g5_shop_order` (
	`od_id`
);

ALTER TABLE `g5_shop_item_qa` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_item_qa_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_event_item` ADD CONSTRAINT `FK_g5_shop_event_TO_g5_shop_event_item_1` FOREIGN KEY (
	`ev_id`
)
REFERENCES `g5_shop_event` (
	`ev_id`
);

ALTER TABLE `g5_shop_event_item` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_event_item_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_board_file` ADD CONSTRAINT `FK_g5_board_TO_g5_board_file_1` FOREIGN KEY (
	`bo_table2`
)
REFERENCES `g5_board` (
	`bo_table`
);

ALTER TABLE `g5_board` ADD CONSTRAINT `FK_g5_group_TO_g5_board_1` FOREIGN KEY (
	`gr_id`
)
REFERENCES `g5_group` (
	`gr_id`
);

ALTER TABLE `g5_poll_etc` ADD CONSTRAINT `FK_g5_poll_TO_g5_poll_etc_1` FOREIGN KEY (
	`po_id`
)
REFERENCES `g5_poll` (
	`po_id`
);

ALTER TABLE `g5_shop_item_stocksms` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_item_stocksms_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_item` ADD CONSTRAINT `FK_g5_shop_category_TO_g5_shop_item_1` FOREIGN KEY (
	`ca_id`
)
REFERENCES `g5_shop_category` (
	`ca_id`
);

ALTER TABLE `g5_group_member` ADD CONSTRAINT `FK_g5_group_TO_g5_group_member_1` FOREIGN KEY (
	`gr_id`
)
REFERENCES `g5_group` (
	`gr_id`
);

ALTER TABLE `g5_shop_item_use` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_item_use_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_item_option` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_item_option_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_item_relation` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_item_relation_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_wish` ADD CONSTRAINT `FK_g5_shop_item_TO_g5_shop_wish_1` FOREIGN KEY (
	`it_id`
)
REFERENCES `g5_shop_item` (
	`it_id`
);

ALTER TABLE `g5_shop_coupon` ADD CONSTRAINT `FK_g5_shop_coupon_zone_TO_g5_shop_coupon_1` FOREIGN KEY (
	`cz_id`
)
REFERENCES `g5_shop_coupon_zone` (
	`cz_id`
);

ALTER TABLE `g5_shop_coupon` ADD CONSTRAINT `FK_g5_shop_order_TO_g5_shop_coupon_1` FOREIGN KEY (
	`od_id`
)
REFERENCES `g5_shop_order` (
	`od_id`
);

ALTER TABLE `g5_board_new` ADD CONSTRAINT `FK_g5_board_TO_g5_board_new_1` FOREIGN KEY (
	`bo_table`
)
REFERENCES `g5_board` (
	`bo_table`
);

ALTER TABLE `g5_shop_personalpay` ADD CONSTRAINT `FK_g5_shop_order_TO_g5_shop_personalpay_1` FOREIGN KEY (
	`od_id`
)
REFERENCES `g5_shop_order` (
	`od_id`
);

ALTER TABLE `g5_shop_order_data` ADD CONSTRAINT `FK_g5_shop_order_TO_g5_shop_order_data_1` FOREIGN KEY (
	`od_id`
)
REFERENCES `g5_shop_order` (
	`od_id`
);

