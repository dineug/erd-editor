CREATE TABLE `sales_sequence_meta` (
	`meta_id`	int(10)	NOT NULL	COMMENT 'Id',
	`entity_type`	varchar(32)	NOT NULL	COMMENT 'Prefix',
	`store_id`	smallint(5)	NOT NULL	COMMENT 'Store Id',
	`sequence_table`	varchar(32)	NOT NULL	COMMENT 'table for sequence'
);

CREATE TABLE `salesrule_coupon_usage` (
	`coupon_id`	int(10)	NOT NULL	COMMENT 'Coupon Id',
	`customer_id`	int(10)	NOT NULL	COMMENT 'Customer Id',
	`times_used`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Times Used'
);

CREATE TABLE `salesrule_coupon_aggregated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NOT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`coupon_code`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Coupon Code',
	`coupon_uses`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Coupon Uses',
	`subtotal_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Subtotal Amount',
	`discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount',
	`total_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Amount',
	`subtotal_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Subtotal Amount Actual',
	`discount_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount Actual',
	`total_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Amount Actual',
	`rule_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Rule Name'
);

CREATE TABLE `sales_shipment_item` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`row_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total',
	`price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price',
	`weight`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weight',
	`qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Qty',
	`product_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`order_item_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Order Item Id',
	`additional_data`	text	NULL	COMMENT 'Additional Data',
	`description`	text	NULL	COMMENT 'Description',
	`name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Name',
	`sku`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Sku'
);

CREATE TABLE `sales_order_status_state` (
	`state`	varchar(32)	NOT NULL	COMMENT 'Label',
	`status`	varchar(32)	NOT NULL	COMMENT 'Status',
	`is_default`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Is Default',
	`visible_on_front`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Visible on front'
);

CREATE TABLE `sales_shipment_grid` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_increment_id`	varchar(32)	NOT NULL	COMMENT 'Order Increment Id',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`order_created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Order Increment Id',
	`customer_name`	varchar(128)	NOT NULL	COMMENT 'Customer Name',
	`total_qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Qty',
	`shipment_status`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipment Status',
	`order_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Order',
	`billing_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Address',
	`shipping_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Address',
	`billing_name`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Billing Name',
	`shipping_name`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Shipping Name',
	`customer_email`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Email',
	`customer_group_id`	int(11)	NULL,
	`payment_method`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Payment Method',
	`shipping_information`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Method Name',
	`created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Created At',
	`updated_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Updated At',
	`FULLTEXT`	KEY	NULL
);

CREATE TABLE `sales_invoiced_aggregated_order` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NOT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`orders_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Orders Invoiced',
	`invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced',
	`invoiced_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced Captured',
	`invoiced_not_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced Not Captured'
);

CREATE TABLE `sales_bestsellers_aggregated_monthly` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`product_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`product_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Product Name',
	`product_price`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Product Price',
	`qty_ordered`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Qty Ordered',
	`rating_pos`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Rating Pos'
);

CREATE TABLE `sales_order_status_label` (
	`status`	varchar(32)	NOT NULL	COMMENT 'Status',
	`store_id`	smallint(5)	NOT NULL	COMMENT 'Store Id',
	`label`	varchar(128)	NOT NULL	COMMENT 'Label'
);

CREATE TABLE `customer_group` (
	`customer_group_id`	int(10)	NOT NULL
);

CREATE TABLE `sales_sequence_profile` (
	`profile_id`	int(10)	NOT NULL	COMMENT 'Id',
	`meta_id`	int(10)	NOT NULL	COMMENT 'Meta_id',
	`prefix`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Prefix',
	`suffix`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Suffix',
	`start_value`	int(10)	NOT NULL	DEFAULT '1'	COMMENT 'Start value for sequence',
	`step`	int(10)	NOT NULL	DEFAULT '1'	COMMENT 'Step for sequence',
	`max_value`	int(10)	NOT NULL	COMMENT 'MaxValue for sequence',
	`warning_value`	int(10)	NOT NULL	COMMENT 'WarningValue for sequence',
	`is_active`	tinyint(1)	NOT NULL	DEFAULT '0'	COMMENT 'isActive flag'
);

CREATE TABLE `salesrule_coupon_aggregated_updated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NOT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`coupon_code`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Coupon Code',
	`coupon_uses`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Coupon Uses',
	`subtotal_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Subtotal Amount',
	`discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount',
	`total_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Amount',
	`subtotal_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Subtotal Amount Actual',
	`discount_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount Actual',
	`total_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Amount Actual',
	`rule_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Rule Name'
);

CREATE TABLE `sales_bestsellers_aggregated_daily` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`product_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`product_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Product Name',
	`product_price`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Product Price',
	`qty_ordered`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Qty Ordered',
	`rating_pos`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Rating Pos'
);

CREATE TABLE `sales_order_item` (
	`item_id`	int(10)	NOT NULL	COMMENT 'Item Id',
	`order_id`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Order Id',
	`parent_item_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Parent Item Id',
	`quote_item_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Quote Item Id',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At',
	`product_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`product_type`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Product Type',
	`product_options`	text	NULL	COMMENT 'Product Options',
	`weight`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Weight',
	`is_virtual`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Virtual',
	`sku`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Sku',
	`name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Name',
	`description`	text	NULL	COMMENT 'Description',
	`applied_rule_ids`	text	NULL	COMMENT 'Applied Rule Ids',
	`additional_data`	text	NULL	COMMENT 'Additional Data',
	`is_qty_decimal`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Qty Decimal',
	`no_discount`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'No Discount',
	`qty_backordered`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Backordered',
	`qty_canceled`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Canceled',
	`qty_invoiced`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Invoiced',
	`qty_ordered`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Ordered',
	`qty_refunded`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Refunded',
	`qty_shipped`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Qty Shipped',
	`base_cost`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Cost',
	`price`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Price',
	`base_price`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Base Price',
	`original_price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Original Price',
	`base_original_price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Original Price',
	`tax_percent`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Tax Percent',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Tax Amount',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Tax Amount',
	`tax_invoiced`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Tax Invoiced',
	`base_tax_invoiced`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Tax Invoiced',
	`discount_percent`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Discount Percent',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Discount Amount',
	`discount_invoiced`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Discount Invoiced',
	`base_discount_invoiced`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Discount Invoiced',
	`amount_refunded`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Amount Refunded',
	`base_amount_refunded`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Base Amount Refunded',
	`row_total`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Row Total',
	`base_row_total`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Base Row Total',
	`row_invoiced`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Row Invoiced',
	`base_row_invoiced`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Base Row Invoiced',
	`row_weight`	decimal(12,4)	NULL	DEFAULT '0.0000'	COMMENT 'Row Weight',
	`base_tax_before_discount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Before Discount',
	`tax_before_discount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Before Discount',
	`ext_order_item_id`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Ext Order Item Id',
	`locked_do_invoice`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Locked Do Invoice',
	`locked_do_ship`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Locked Do Ship',
	`price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price Incl Tax',
	`base_price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Price Incl Tax',
	`row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total Incl Tax',
	`base_row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Row Total Incl Tax',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`discount_tax_compensation_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Invoiced',
	`base_discount_tax_compensation_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Invoiced',
	`discount_tax_compensation_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Refunded',
	`base_discount_tax_compensation_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Refunded',
	`tax_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Canceled',
	`discount_tax_compensation_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Canceled',
	`tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Refunded',
	`base_tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Refunded',
	`discount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Refunded',
	`base_discount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Refunded',
	`free_shipping`	smallint(6)	NULL,
	`gift_message_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Gift Message Id',
	`gift_message_available`	int(11)	NULL	DEFAULT NULL	COMMENT 'Gift Message Available',
	`weee_tax_applied`	text	NULL	COMMENT 'Weee Tax Applied',
	`weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Amount',
	`weee_tax_applied_row_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Row Amount',
	`weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Disposition',
	`weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Row Disposition',
	`base_weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Amount',
	`base_weee_tax_applied_row_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Row Amnt',
	`base_weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Disposition',
	`base_weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Row Disposition'
);

CREATE TABLE `sales_invoice` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Tax Amount',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Amount',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Amount',
	`store_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Order Rate',
	`base_shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Tax Amount',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Amount',
	`base_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Order Rate',
	`grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Grand Total',
	`shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Amount',
	`subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Incl Tax',
	`base_subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Incl Tax',
	`store_to_base_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Base Rate',
	`base_shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Amount',
	`total_qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Qty',
	`base_to_global_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Global Rate',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`base_subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Amount',
	`billing_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Billing Address Id',
	`is_used_for_refund`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Used For Refund',
	`email_sent`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Email Sent',
	`send_email`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Send Email',
	`can_void_flag`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Can Void Flag',
	`state`	int(11)	NULL	DEFAULT NULL	COMMENT 'State',
	`shipping_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipping Address Id',
	`store_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Store Currency Code',
	`transaction_id`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Transaction Id',
	`order_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Order Currency Code',
	`base_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Base Currency Code',
	`global_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Global Currency Code',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`shipping_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Discount Tax Compensation Amount',
	`base_shipping_discount_tax_compensation_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Discount Tax Compensation Amount',
	`shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Incl Tax',
	`base_shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Incl Tax',
	`base_total_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Refunded',
	`discount_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Discount Description',
	`customer_note`	text	NULL	COMMENT 'Customer Note',
	`customer_note_notify`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Customer Note Notify'
);

CREATE TABLE `salesrule` (
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id',
	`name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Name',
	`description`	text	NULL	COMMENT 'Description',
	`from_date`	date	NULL	DEFAULT NULL	COMMENT 'From',
	`to_date`	date	NULL	DEFAULT NULL	COMMENT 'To',
	`uses_per_customer`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Uses Per Customer',
	`is_active`	smallint(6)	NOT NULL	DEFAULT '0'	COMMENT 'Is Active',
	`conditions_serialized`	mediumtext	NULL	COMMENT 'Conditions Serialized',
	`actions_serialized`	mediumtext	NULL	COMMENT 'Actions Serialized',
	`stop_rules_processing`	smallint(6)	NOT NULL	DEFAULT '1'	COMMENT 'Stop Rules Processing',
	`is_advanced`	smallint(5)	NOT NULL	DEFAULT '1'	COMMENT 'Is Advanced',
	`product_ids`	text	NULL	COMMENT 'Product Ids',
	`sort_order`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Sort Order',
	`simple_action`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Simple Action',
	`discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount',
	`discount_qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Qty',
	`discount_step`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Discount Step',
	`apply_to_shipping`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Apply To Shipping',
	`times_used`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Times Used',
	`is_rss`	smallint(6)	NOT NULL	DEFAULT '0'	COMMENT 'Is Rss',
	`coupon_type`	smallint(5)	NOT NULL	DEFAULT '1'	COMMENT 'Coupon Type',
	`use_auto_generation`	smallint(6)	NOT NULL	DEFAULT '0'	COMMENT 'Use Auto Generation',
	`uses_per_coupon`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'User Per Coupon',
	`simple_free_shipping`	smallint(6)	NULL
);

CREATE TABLE `sales_order_payment` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`base_shipping_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Captured',
	`shipping_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Captured',
	`amount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount Refunded',
	`base_amount_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Paid',
	`amount_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount Canceled',
	`base_amount_authorized`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Authorized',
	`base_amount_paid_online`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Paid Online',
	`base_amount_refunded_online`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Refunded Online',
	`base_shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Amount',
	`shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Amount',
	`amount_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount Paid',
	`amount_authorized`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount Authorized',
	`base_amount_ordered`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Ordered',
	`base_shipping_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Refunded',
	`shipping_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Refunded',
	`base_amount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Refunded',
	`amount_ordered`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount Ordered',
	`base_amount_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount Canceled',
	`quote_payment_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Quote Payment Id',
	`additional_data`	text	NULL	COMMENT 'Additional Data',
	`cc_exp_month`	varchar(12)	NULL	DEFAULT NULL	COMMENT 'Cc Exp Month',
	`cc_ss_start_year`	varchar(12)	NULL	DEFAULT NULL	COMMENT 'Cc Ss Start Year',
	`echeck_bank_name`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Echeck Bank Name',
	`method`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Method',
	`cc_debug_request_body`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Debug Request Body',
	`cc_secure_verify`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Secure Verify',
	`protection_eligibility`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Protection Eligibility',
	`cc_approval`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Approval',
	`cc_last_4`	varchar(100)	NULL	DEFAULT NULL	COMMENT 'Cc Last 4',
	`cc_status_description`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Status Description',
	`echeck_type`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Echeck Type',
	`cc_debug_response_serialized`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Debug Response Serialized',
	`cc_ss_start_month`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Cc Ss Start Month',
	`echeck_account_type`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Echeck Account Type',
	`last_trans_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Last Trans Id',
	`cc_cid_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Cid Status',
	`cc_owner`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Cc Owner',
	`cc_type`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Type',
	`po_number`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Po Number',
	`cc_exp_year`	varchar(4)	NULL	DEFAULT NULL	COMMENT 'Cc Exp Year',
	`cc_status`	varchar(4)	NULL	DEFAULT NULL	COMMENT 'Cc Status',
	`echeck_routing_number`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Echeck Routing Number',
	`account_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Account Status',
	`anet_trans_method`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Anet Trans Method',
	`cc_debug_response_body`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Debug Response Body',
	`cc_ss_issue`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Ss Issue',
	`echeck_account_name`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Echeck Account Name',
	`cc_avs_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Avs Status',
	`cc_number_enc`	varchar(128)	NULL,
	`cc_trans_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Cc Trans Id',
	`address_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Address Status',
	`additional_information`	text	NULL	COMMENT 'Additional Information'
);

CREATE TABLE `sales_shipment_track` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`weight`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weight',
	`qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Qty',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`track_number`	text	NULL	COMMENT 'Number',
	`description`	text	NULL	COMMENT 'Description',
	`title`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Title',
	`carrier_code`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Carrier Code',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At'
);

CREATE TABLE `sales_order_tax_item` (
	`tax_item_id`	int(10)	NOT NULL	COMMENT 'Tax Item Id',
	`tax_id`	int(10)	NOT NULL	COMMENT 'Tax Id',
	`item_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Item Id',
	`tax_percent`	decimal(12,4)	NOT NULL	COMMENT 'Real Tax Percent For Item',
	`amount`	decimal(12,4)	NOT NULL	COMMENT 'Tax amount for the item and tax rate',
	`base_amount`	decimal(12,4)	NOT NULL	COMMENT 'Base tax amount for the item and tax rate',
	`real_amount`	decimal(12,4)	NOT NULL	COMMENT 'Real tax amount for the item and tax rate',
	`real_base_amount`	decimal(12,4)	NOT NULL	COMMENT 'Real base tax amount for the item and tax rate',
	`associated_item_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Id of the associated item',
	`taxable_item_type`	varchar(32)	NOT NULL	COMMENT 'Type of the taxable item'
);

CREATE TABLE `customer_entity` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id'
);

CREATE TABLE `sales_shipping_aggregated_order` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`shipping_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Description',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`total_shipping`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Shipping',
	`total_shipping_actual`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Shipping Actual'
);

CREATE TABLE `salesrule_coupon` (
	`coupon_id`	int(10)	NOT NULL	COMMENT 'Coupon Id',
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id',
	`code`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Code',
	`usage_limit`	int(10)	NULL	DEFAULT NULL	COMMENT 'Usage Limit',
	`usage_per_customer`	int(10)	NULL	DEFAULT NULL	COMMENT 'Usage Per Customer',
	`times_used`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Times Used',
	`expiration_date`	timestamp	NULL	DEFAULT NULL	COMMENT 'Expiration Date',
	`is_primary`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Primary',
	`created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Coupon Code Creation Date',
	`type`	smallint(6)	NULL	DEFAULT '0'	COMMENT 'Coupon Code Type'
);

CREATE TABLE `sales_order_status` (
	`status`	varchar(32)	NOT NULL	COMMENT 'Status',
	`label`	varchar(128)	NOT NULL	COMMENT 'Label'
);

CREATE TABLE `salesrule_customer` (
	`rule_customer_id`	int(10)	NOT NULL	COMMENT 'Rule Customer Id',
	`customer_id`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Customer Id',
	`rule_id`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Rule Id',
	`times_used`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Times Used'
);

CREATE TABLE `sales_bestsellers_aggregated_yearly` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`product_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`product_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Product Name',
	`product_price`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Product Price',
	`qty_ordered`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Qty Ordered',
	`rating_pos`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Rating Pos'
);

CREATE TABLE `store` (
	`store_id`	smallint(5)	NOT NULL	COMMENT 'Store Id'
);

CREATE TABLE `sales_creditmemo_comment` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`is_customer_notified`	int(11)	NULL	DEFAULT NULL	COMMENT 'Is Customer Notified',
	`is_visible_on_front`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Is Visible On Front',
	`comment`	text	NULL	COMMENT 'Comment',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At'
);

CREATE TABLE `sales_invoiced_aggregated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`orders_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Orders Invoiced',
	`invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced',
	`invoiced_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced Captured',
	`invoiced_not_captured`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Invoiced Not Captured'
);

CREATE TABLE `sales_invoice_grid` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`state`	int(11)	NULL	DEFAULT NULL	COMMENT 'State',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`store_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Store Name',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`order_increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Increment Id',
	`order_created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Order Created At',
	`customer_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Customer Name',
	`customer_email`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Customer Email',
	`customer_group_id`	int(11)	NULL,
	`payment_method`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Payment Method',
	`store_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Store Currency Code',
	`order_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Order Currency Code',
	`base_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Base Currency Code',
	`global_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Global Currency Code',
	`billing_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Name',
	`billing_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Address',
	`shipping_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Address',
	`shipping_information`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Method Name',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`shipping_and_handling`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping and handling amount',
	`grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Grand Total',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Created At',
	`updated_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Updated At',
	`FULLTEXT`	KEY	NULL
);

CREATE TABLE `salesrule_customer_group` (
	`customer_group_id`	int(10)	NOT NULL	COMMENT 'Customer Group Id',
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id'
);

CREATE TABLE `sales_shipment_comment` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`is_customer_notified`	int(11)	NULL	DEFAULT NULL	COMMENT 'Is Customer Notified',
	`is_visible_on_front`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Is Visible On Front',
	`comment`	text	NULL	COMMENT 'Comment',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At'
);

CREATE TABLE `sales_order` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`state`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'State',
	`status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Status',
	`coupon_code`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Coupon Code',
	`protect_code`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Protect Code',
	`shipping_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Description',
	`is_virtual`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Virtual',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`customer_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Customer Id',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Amount',
	`base_discount_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Canceled',
	`base_discount_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Invoiced',
	`base_discount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Refunded',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`base_shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Amount',
	`base_shipping_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Canceled',
	`base_shipping_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Invoiced',
	`base_shipping_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Refunded',
	`base_shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Tax Amount',
	`base_shipping_tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Tax Refunded',
	`base_subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal',
	`base_subtotal_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Canceled',
	`base_subtotal_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Invoiced',
	`base_subtotal_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Refunded',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Amount',
	`base_tax_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Canceled',
	`base_tax_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Invoiced',
	`base_tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Refunded',
	`base_to_global_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Global Rate',
	`base_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Order Rate',
	`base_total_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Canceled',
	`base_total_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Invoiced',
	`base_total_invoiced_cost`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Invoiced Cost',
	`base_total_offline_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Offline Refunded',
	`base_total_online_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Online Refunded',
	`base_total_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Paid',
	`base_total_qty_ordered`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Qty Ordered',
	`base_total_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Refunded',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Amount',
	`discount_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Canceled',
	`discount_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Invoiced',
	`discount_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Refunded',
	`grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Grand Total',
	`shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Amount',
	`shipping_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Canceled',
	`shipping_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Invoiced',
	`shipping_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Refunded',
	`shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Tax Amount',
	`shipping_tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Tax Refunded',
	`store_to_base_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Base Rate',
	`store_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Order Rate',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`subtotal_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Canceled',
	`subtotal_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Invoiced',
	`subtotal_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Refunded',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Amount',
	`tax_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Canceled',
	`tax_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Invoiced',
	`tax_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Refunded',
	`total_canceled`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Canceled',
	`total_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Invoiced',
	`total_offline_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Offline Refunded',
	`total_online_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Online Refunded',
	`total_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Paid',
	`total_qty_ordered`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Qty Ordered',
	`total_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Refunded',
	`can_ship_partially`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Can Ship Partially',
	`can_ship_partially_item`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Can Ship Partially Item',
	`customer_is_guest`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Customer Is Guest',
	`customer_note_notify`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Customer Note Notify',
	`billing_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Billing Address Id',
	`customer_group_id`	int(11)	NULL,
	`edit_increment`	int(11)	NULL	DEFAULT NULL	COMMENT 'Edit Increment',
	`email_sent`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Email Sent',
	`send_email`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Send Email',
	`forced_shipment_with_invoice`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Forced Do Shipment With Invoice',
	`payment_auth_expiration`	int(11)	NULL	DEFAULT NULL	COMMENT 'Payment Authorization Expiration',
	`quote_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Quote Address Id',
	`quote_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Quote Id',
	`shipping_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipping Address Id',
	`adjustment_negative`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Negative',
	`adjustment_positive`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Positive',
	`base_adjustment_negative`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Adjustment Negative',
	`base_adjustment_positive`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Adjustment Positive',
	`base_shipping_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Discount Amount',
	`base_subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Incl Tax',
	`base_total_due`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Due',
	`payment_authorization_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Payment Authorization Amount',
	`shipping_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Discount Amount',
	`subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Incl Tax',
	`total_due`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Due',
	`weight`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weight',
	`customer_dob`	datetime	NULL	DEFAULT NULL	COMMENT 'Customer Dob',
	`increment_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`applied_rule_ids`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Applied Rule Ids',
	`base_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Base Currency Code',
	`customer_email`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Email',
	`customer_firstname`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Firstname',
	`customer_lastname`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Lastname',
	`customer_middlename`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Middlename',
	`customer_prefix`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Customer Prefix',
	`customer_suffix`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Customer Suffix',
	`customer_taxvat`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Customer Taxvat',
	`discount_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Discount Description',
	`ext_customer_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Ext Customer Id',
	`ext_order_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Ext Order Id',
	`global_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Global Currency Code',
	`hold_before_state`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Hold Before State',
	`hold_before_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Hold Before Status',
	`order_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Order Currency Code',
	`original_increment_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Original Increment Id',
	`relation_child_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Relation Child Id',
	`relation_child_real_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Relation Child Real Id',
	`relation_parent_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Relation Parent Id',
	`relation_parent_real_id`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Relation Parent Real Id',
	`remote_ip`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Remote Ip',
	`shipping_method`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Shipping Method',
	`store_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Store Currency Code',
	`store_name`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Store Name',
	`x_forwarded_for`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'X Forwarded For',
	`customer_note`	text	NULL	COMMENT 'Customer Note',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At',
	`total_item_count`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Total Item Count',
	`customer_gender`	int(11)	NULL	DEFAULT NULL	COMMENT 'Customer Gender',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`shipping_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Discount Tax Compensation Amount',
	`base_shipping_discount_tax_compensation_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Discount Tax Compensation Amount',
	`discount_tax_compensation_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Invoiced',
	`base_discount_tax_compensation_invoiced`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Invoiced',
	`discount_tax_compensation_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Refunded',
	`base_discount_tax_compensation_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Refunded',
	`shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Incl Tax',
	`base_shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Incl Tax',
	`coupon_rule_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Coupon Sales Rule Name',
	`paypal_ipn_customer_notified`	int(11)	NULL	DEFAULT '0'	COMMENT 'Paypal Ipn Customer Notified',
	`gift_message_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Gift Message Id'
);

CREATE TABLE `sales_invoice_item` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`base_price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Price',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Amount',
	`base_row_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Row Total',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Amount',
	`row_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Amount',
	`price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price Incl Tax',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Amount',
	`base_price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Price Incl Tax',
	`qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Qty',
	`base_cost`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Cost',
	`price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price',
	`base_row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Row Total Incl Tax',
	`row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total Incl Tax',
	`product_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`order_item_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Order Item Id',
	`additional_data`	text	NULL	COMMENT 'Additional Data',
	`description`	text	NULL	COMMENT 'Description',
	`sku`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Sku',
	`name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Name',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`tax_ratio`	text	NULL	COMMENT 'Ratio of tax invoiced over tax of the order item',
	`weee_tax_applied`	text	NULL	COMMENT 'Weee Tax Applied',
	`weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Amount',
	`weee_tax_applied_row_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Row Amount',
	`weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Disposition',
	`weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Row Disposition',
	`base_weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Amount',
	`base_weee_tax_applied_row_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Row Amnt',
	`base_weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Disposition',
	`base_weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Row Disposition'
);

CREATE TABLE `sales_order_address` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Parent Id',
	`customer_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Customer Address Id',
	`quote_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Quote Address Id',
	`region_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Region Id',
	`customer_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Customer Id',
	`fax`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Fax',
	`region`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Region',
	`postcode`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Postcode',
	`lastname`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Lastname',
	`street`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Street',
	`city`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'City',
	`email`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Email',
	`telephone`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Phone Number',
	`country_id`	varchar(2)	NULL	DEFAULT NULL	COMMENT 'Country Id',
	`firstname`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Firstname',
	`address_type`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Address Type',
	`prefix`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Prefix',
	`middlename`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Middlename',
	`suffix`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Suffix',
	`company`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Company',
	`vat_id`	text	NULL	COMMENT 'Vat Id',
	`vat_is_valid`	smallint(6)	NULL	DEFAULT NULL	COMMENT 'Vat Is Valid',
	`vat_request_id`	text	NULL	COMMENT 'Vat Request Id',
	`vat_request_date`	text	NULL	COMMENT 'Vat Request Date',
	`vat_request_success`	smallint(6)	NULL	DEFAULT NULL	COMMENT 'Vat Request Success'
);

CREATE TABLE `sales_creditmemo_grid` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Created At',
	`updated_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Updated At',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`order_increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Increment Id',
	`order_created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Order Created At',
	`billing_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Name',
	`state`	int(11)	NULL	DEFAULT NULL	COMMENT 'Status',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`order_status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`billing_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Address',
	`shipping_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Address',
	`customer_name`	varchar(128)	NOT NULL	COMMENT 'Customer Name',
	`customer_email`	varchar(128)	NULL	DEFAULT NULL	COMMENT 'Customer Email',
	`customer_group_id`	smallint(6)	NULL	DEFAULT NULL	COMMENT 'Customer Group Id',
	`payment_method`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Payment Method',
	`shipping_information`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Method Name',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`shipping_and_handling`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping and handling amount',
	`adjustment_positive`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Positive',
	`adjustment_negative`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Negative',
	`order_base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Order Grand Total',
	`FULLTEXT`	KEY	NULL
);

CREATE TABLE `sales_order_grid` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Status',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`store_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Store Name',
	`customer_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Customer Id',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`base_total_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Total Paid',
	`grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Grand Total',
	`total_paid`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Paid',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`base_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Base Currency Code',
	`order_currency_code`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Order Currency Code',
	`shipping_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Name',
	`billing_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Name',
	`created_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Created At',
	`updated_at`	timestamp	NULL	DEFAULT NULL	COMMENT 'Updated At',
	`billing_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Billing Address',
	`shipping_address`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Address',
	`shipping_information`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Method Name',
	`customer_email`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Customer Email',
	`customer_group`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Customer Group',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`shipping_and_handling`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping and handling amount',
	`customer_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Customer Name',
	`payment_method`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Payment Method',
	`total_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Refunded',
	`FULLTEXT`	KEY	NULL
);

CREATE TABLE `salesrule_website` (
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id',
	`website_id`	smallint(5)	NOT NULL	COMMENT 'Website Id'
);

CREATE TABLE `sales_order_status_history` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`is_customer_notified`	int(11)	NULL	DEFAULT NULL	COMMENT 'Is Customer Notified',
	`is_visible_on_front`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Is Visible On Front',
	`comment`	text	NULL	COMMENT 'Comment',
	`status`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Status',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`entity_name`	varchar(32)	NULL	DEFAULT NULL	COMMENT 'Shows what entity history is bind to.'
);

CREATE TABLE `eav_attribute` (
	`attribute_id`	smallint(5)	NOT NULL	COMMENT 'Attribute Id'
);

CREATE TABLE `sales_invoice_comment` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`is_customer_notified`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Is Customer Notified',
	`is_visible_on_front`	smallint(5)	NOT NULL	DEFAULT '0'	COMMENT 'Is Visible On Front',
	`comment`	text	NULL	COMMENT 'Comment',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At'
);

CREATE TABLE `sales_order_aggregated_created` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NOT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`total_qty_ordered`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Qty Ordered',
	`total_qty_invoiced`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Qty Invoiced',
	`total_income_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Income Amount',
	`total_revenue_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Revenue Amount',
	`total_profit_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Profit Amount',
	`total_invoiced_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Invoiced Amount',
	`total_canceled_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Canceled Amount',
	`total_paid_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Paid Amount',
	`total_refunded_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Refunded Amount',
	`total_tax_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Tax Amount',
	`total_tax_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Tax Amount Actual',
	`total_shipping_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Shipping Amount',
	`total_shipping_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Shipping Amount Actual',
	`total_discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Discount Amount',
	`total_discount_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Discount Amount Actual'
);

CREATE TABLE `sales_shipment` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`total_weight`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Weight',
	`total_qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Qty',
	`email_sent`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Email Sent',
	`send_email`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Send Email',
	`customer_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Customer Id',
	`shipping_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipping Address Id',
	`billing_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Billing Address Id',
	`shipment_status`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipment Status',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At',
	`packages`	text	NULL	COMMENT 'Packed Products in Packages',
	`shipping_label`	mediumblob	NULL	COMMENT 'Shipping Label Content',
	`customer_note`	text	NULL	COMMENT 'Customer Note',
	`customer_note_notify`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Customer Note Notify'
);

CREATE TABLE `sales_creditmemo_item` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`parent_id`	int(10)	NOT NULL	COMMENT 'Parent Id',
	`base_price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Price',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Amount',
	`base_row_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Row Total',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Amount',
	`row_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Amount',
	`price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price Incl Tax',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Amount',
	`base_price_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Price Incl Tax',
	`qty`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Qty',
	`base_cost`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Cost',
	`price`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Price',
	`base_row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Row Total Incl Tax',
	`row_total_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Row Total Incl Tax',
	`product_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Product Id',
	`order_item_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Order Item Id',
	`additional_data`	text	NULL	COMMENT 'Additional Data',
	`description`	text	NULL	COMMENT 'Description',
	`sku`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Sku',
	`name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Name',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`tax_ratio`	text	NULL	COMMENT 'Ratio of tax in the creditmemo item over tax of the order item',
	`weee_tax_applied`	text	NULL	COMMENT 'Weee Tax Applied',
	`weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Amount',
	`weee_tax_applied_row_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Applied Row Amount',
	`weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Disposition',
	`weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Weee Tax Row Disposition',
	`base_weee_tax_applied_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Amount',
	`base_weee_tax_applied_row_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Applied Row Amnt',
	`base_weee_tax_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Disposition',
	`base_weee_tax_row_disposition`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Weee Tax Row Disposition'
);

CREATE TABLE `store_website` (
	`website_id`	smallint(5)	NOT NULL	COMMENT 'Website Id'
);

CREATE TABLE `sales_shipping_aggregated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`shipping_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Shipping Description',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`total_shipping`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Shipping',
	`total_shipping_actual`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Total Shipping Actual'
);

CREATE TABLE `sales_creditmemo` (
	`entity_id`	int(10)	NOT NULL	COMMENT 'Entity Id',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`adjustment_positive`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Positive',
	`base_shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Tax Amount',
	`store_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Order Rate',
	`base_discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Amount',
	`base_to_order_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Order Rate',
	`grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Grand Total',
	`base_adjustment_negative`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Adjustment Negative',
	`base_subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal Incl Tax',
	`shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Amount',
	`subtotal_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal Incl Tax',
	`adjustment_negative`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment Negative',
	`base_shipping_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Amount',
	`store_to_base_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Store To Base Rate',
	`base_to_global_rate`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base To Global Rate',
	`base_adjustment`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Adjustment',
	`base_subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Subtotal',
	`discount_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Amount',
	`subtotal`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Subtotal',
	`adjustment`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Adjustment',
	`base_grand_total`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Grand Total',
	`base_adjustment_positive`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Adjustment Positive',
	`base_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Tax Amount',
	`shipping_tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Tax Amount',
	`tax_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Tax Amount',
	`email_sent`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Email Sent',
	`send_email`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Send Email',
	`creditmemo_status`	int(11)	NULL	DEFAULT NULL	COMMENT 'Creditmemo Status',
	`state`	int(11)	NULL	DEFAULT NULL	COMMENT 'State',
	`shipping_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Shipping Address Id',
	`billing_address_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Billing Address Id',
	`invoice_id`	int(11)	NULL	DEFAULT NULL	COMMENT 'Invoice Id',
	`store_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Store Currency Code',
	`order_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Order Currency Code',
	`base_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Base Currency Code',
	`global_currency_code`	varchar(3)	NULL	DEFAULT NULL	COMMENT 'Global Currency Code',
	`transaction_id`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Transaction Id',
	`increment_id`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Increment Id',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At',
	`updated_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Updated At',
	`discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Discount Tax Compensation Amount',
	`base_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Discount Tax Compensation Amount',
	`shipping_discount_tax_compensation_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Discount Tax Compensation Amount',
	`base_shipping_discount_tax_compensation_amnt`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Discount Tax Compensation Amount',
	`shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Shipping Incl Tax',
	`base_shipping_incl_tax`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Shipping Incl Tax',
	`discount_description`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Discount Description',
	`customer_note`	text	NULL	COMMENT 'Customer Note',
	`customer_note_notify`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Customer Note Notify'
);

CREATE TABLE `sales_refunded_aggregated_order` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Refunded',
	`online_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Online Refunded',
	`offline_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Offline Refunded'
);

CREATE TABLE `sales_order_tax` (
	`tax_id`	int(10)	NOT NULL	COMMENT 'Tax Id',
	`order_id`	int(10)	NOT NULL	COMMENT 'Order Id',
	`code`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Code',
	`title`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Title',
	`percent`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Percent',
	`amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Amount',
	`priority`	int(11)	NOT NULL	COMMENT 'Priority',
	`position`	int(11)	NOT NULL	COMMENT 'Position',
	`base_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Amount',
	`process`	smallint(6)	NOT NULL	COMMENT 'Process',
	`base_real_amount`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Base Real Amount'
);

CREATE TABLE `sales_order_aggregated_updated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NOT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`total_qty_ordered`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Qty Ordered',
	`total_qty_invoiced`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Qty Invoiced',
	`total_income_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Income Amount',
	`total_revenue_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Revenue Amount',
	`total_profit_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Profit Amount',
	`total_invoiced_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Invoiced Amount',
	`total_canceled_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Canceled Amount',
	`total_paid_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Paid Amount',
	`total_refunded_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Refunded Amount',
	`total_tax_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Tax Amount',
	`total_tax_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Tax Amount Actual',
	`total_shipping_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Shipping Amount',
	`total_shipping_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Shipping Amount Actual',
	`total_discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Discount Amount',
	`total_discount_amount_actual`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Discount Amount Actual'
);

CREATE TABLE `salesrule_product_attribute` (
	`attribute_id`	smallint(5)	NOT NULL	COMMENT 'Attribute Id',
	`customer_group_id`	int(10)	NOT NULL	COMMENT 'Customer Group Id',
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id',
	`website_id`	smallint(5)	NOT NULL	COMMENT 'Website Id'
);

CREATE TABLE `sales_payment_transaction` (
	`transaction_id`	int(10)	NOT NULL	COMMENT 'Transaction Id',
	`order_id`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Order Id',
	`payment_id`	int(10)	NOT NULL	DEFAULT '0'	COMMENT 'Payment Id',
	`parent_id`	int(10)	NULL	DEFAULT NULL	COMMENT 'Parent Id',
	`txn_id`	varchar(100)	NULL	DEFAULT NULL	COMMENT 'Txn Id',
	`parent_txn_id`	varchar(100)	NULL	DEFAULT NULL	COMMENT 'Parent Txn Id',
	`txn_type`	varchar(15)	NULL	DEFAULT NULL	COMMENT 'Txn Type',
	`is_closed`	smallint(5)	NOT NULL	DEFAULT '1'	COMMENT 'Is Closed',
	`additional_information`	blob	NULL	COMMENT 'Additional Information',
	`created_at`	timestamp	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT 'Created At'
);

CREATE TABLE `salesrule_coupon_aggregated_order` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NOT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Order Status',
	`coupon_code`	varchar(50)	NULL	DEFAULT NULL	COMMENT 'Coupon Code',
	`coupon_uses`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Coupon Uses',
	`subtotal_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Subtotal Amount',
	`discount_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Discount Amount',
	`total_amount`	decimal(12,4)	NOT NULL	DEFAULT '0.0000'	COMMENT 'Total Amount',
	`rule_name`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Rule Name'
);

CREATE TABLE `salesrule_label` (
	`label_id`	int(10)	NOT NULL	COMMENT 'Label Id',
	`rule_id`	int(10)	NOT NULL	COMMENT 'Rule Id',
	`store_id`	smallint(5)	NOT NULL	COMMENT 'Store Id',
	`label`	varchar(255)	NULL	DEFAULT NULL	COMMENT 'Label'
);

CREATE TABLE `sales_refunded_aggregated` (
	`id`	int(10)	NOT NULL	COMMENT 'Id',
	`period`	date	NULL	DEFAULT NULL	COMMENT 'Period',
	`store_id`	smallint(5)	NULL	DEFAULT NULL	COMMENT 'Store Id',
	`order_status`	varchar(50)	NOT NULL	COMMENT 'Order Status',
	`orders_count`	int(11)	NOT NULL	DEFAULT '0'	COMMENT 'Orders Count',
	`refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Refunded',
	`online_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Online Refunded',
	`offline_refunded`	decimal(12,4)	NULL	DEFAULT NULL	COMMENT 'Offline Refunded'
);

ALTER TABLE `sales_sequence_meta` ADD CONSTRAINT `PK_SALES_SEQUENCE_META` PRIMARY KEY (
	`meta_id`
);

ALTER TABLE `salesrule_coupon_usage` ADD CONSTRAINT `PK_SALESRULE_COUPON_USAGE` PRIMARY KEY (
	`coupon_id`,
	`customer_id`
);

ALTER TABLE `salesrule_coupon_aggregated` ADD CONSTRAINT `PK_SALESRULE_COUPON_AGGREGATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_shipment_item` ADD CONSTRAINT `PK_SALES_SHIPMENT_ITEM` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_order_status_state` ADD CONSTRAINT `PK_SALES_ORDER_STATUS_STATE` PRIMARY KEY (
	`state`,
	`status`
);

ALTER TABLE `sales_shipment_grid` ADD CONSTRAINT `PK_SALES_SHIPMENT_GRID` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `sales_invoiced_aggregated_order` ADD CONSTRAINT `PK_SALES_INVOICED_AGGREGATED_ORDER` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_bestsellers_aggregated_monthly` ADD CONSTRAINT `PK_SALES_BESTSELLERS_AGGREGATED_MONTHLY` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_order_status_label` ADD CONSTRAINT `PK_SALES_ORDER_STATUS_LABEL` PRIMARY KEY (
	`status`,
	`store_id`
);

ALTER TABLE `customer_group` ADD CONSTRAINT `PK_CUSTOMER_GROUP` PRIMARY KEY (
	`customer_group_id`
);

ALTER TABLE `sales_sequence_profile` ADD CONSTRAINT `PK_SALES_SEQUENCE_PROFILE` PRIMARY KEY (
	`profile_id`,
	`meta_id`
);

ALTER TABLE `salesrule_coupon_aggregated_updated` ADD CONSTRAINT `PK_SALESRULE_COUPON_AGGREGATED_UPDATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_bestsellers_aggregated_daily` ADD CONSTRAINT `PK_SALES_BESTSELLERS_AGGREGATED_DAILY` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_order_item` ADD CONSTRAINT `PK_SALES_ORDER_ITEM` PRIMARY KEY (
	`item_id`,
	`order_id`
);

ALTER TABLE `sales_invoice` ADD CONSTRAINT `PK_SALES_INVOICE` PRIMARY KEY (
	`entity_id`,
	`order_id`
);

ALTER TABLE `salesrule` ADD CONSTRAINT `PK_SALESRULE` PRIMARY KEY (
	`rule_id`
);

ALTER TABLE `sales_order_payment` ADD CONSTRAINT `PK_SALES_ORDER_PAYMENT` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_shipment_track` ADD CONSTRAINT `PK_SALES_SHIPMENT_TRACK` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_order_tax_item` ADD CONSTRAINT `PK_SALES_ORDER_TAX_ITEM` PRIMARY KEY (
	`tax_item_id`,
	`tax_id`
);

ALTER TABLE `customer_entity` ADD CONSTRAINT `PK_CUSTOMER_ENTITY` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `sales_shipping_aggregated_order` ADD CONSTRAINT `PK_SALES_SHIPPING_AGGREGATED_ORDER` PRIMARY KEY (
	`id`
);

ALTER TABLE `salesrule_coupon` ADD CONSTRAINT `PK_SALESRULE_COUPON` PRIMARY KEY (
	`coupon_id`,
	`rule_id`
);

ALTER TABLE `sales_order_status` ADD CONSTRAINT `PK_SALES_ORDER_STATUS` PRIMARY KEY (
	`status`
);

ALTER TABLE `salesrule_customer` ADD CONSTRAINT `PK_SALESRULE_CUSTOMER` PRIMARY KEY (
	`rule_customer_id`,
	`customer_id`,
	`rule_id`
);

ALTER TABLE `sales_bestsellers_aggregated_yearly` ADD CONSTRAINT `PK_SALES_BESTSELLERS_AGGREGATED_YEARLY` PRIMARY KEY (
	`id`
);

ALTER TABLE `store` ADD CONSTRAINT `PK_STORE` PRIMARY KEY (
	`store_id`
);

ALTER TABLE `sales_creditmemo_comment` ADD CONSTRAINT `PK_SALES_CREDITMEMO_COMMENT` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_invoiced_aggregated` ADD CONSTRAINT `PK_SALES_INVOICED_AGGREGATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_invoice_grid` ADD CONSTRAINT `PK_SALES_INVOICE_GRID` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `salesrule_customer_group` ADD CONSTRAINT `PK_SALESRULE_CUSTOMER_GROUP` PRIMARY KEY (
	`customer_group_id`,
	`rule_id`
);

ALTER TABLE `sales_shipment_comment` ADD CONSTRAINT `PK_SALES_SHIPMENT_COMMENT` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_order` ADD CONSTRAINT `PK_SALES_ORDER` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `sales_invoice_item` ADD CONSTRAINT `PK_SALES_INVOICE_ITEM` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_order_address` ADD CONSTRAINT `PK_SALES_ORDER_ADDRESS` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `sales_creditmemo_grid` ADD CONSTRAINT `PK_SALES_CREDITMEMO_GRID` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `sales_order_grid` ADD CONSTRAINT `PK_SALES_ORDER_GRID` PRIMARY KEY (
	`entity_id`
);

ALTER TABLE `salesrule_website` ADD CONSTRAINT `PK_SALESRULE_WEBSITE` PRIMARY KEY (
	`rule_id`,
	`website_id`
);

ALTER TABLE `sales_order_status_history` ADD CONSTRAINT `PK_SALES_ORDER_STATUS_HISTORY` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `eav_attribute` ADD CONSTRAINT `PK_EAV_ATTRIBUTE` PRIMARY KEY (
	`attribute_id`
);

ALTER TABLE `sales_invoice_comment` ADD CONSTRAINT `PK_SALES_INVOICE_COMMENT` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `sales_order_aggregated_created` ADD CONSTRAINT `PK_SALES_ORDER_AGGREGATED_CREATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_shipment` ADD CONSTRAINT `PK_SALES_SHIPMENT` PRIMARY KEY (
	`entity_id`,
	`order_id`
);

ALTER TABLE `sales_creditmemo_item` ADD CONSTRAINT `PK_SALES_CREDITMEMO_ITEM` PRIMARY KEY (
	`entity_id`,
	`parent_id`
);

ALTER TABLE `store_website` ADD CONSTRAINT `PK_STORE_WEBSITE` PRIMARY KEY (
	`website_id`
);

ALTER TABLE `sales_shipping_aggregated` ADD CONSTRAINT `PK_SALES_SHIPPING_AGGREGATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_creditmemo` ADD CONSTRAINT `PK_SALES_CREDITMEMO` PRIMARY KEY (
	`entity_id`,
	`order_id`
);

ALTER TABLE `sales_refunded_aggregated_order` ADD CONSTRAINT `PK_SALES_REFUNDED_AGGREGATED_ORDER` PRIMARY KEY (
	`id`
);

ALTER TABLE `sales_order_tax` ADD CONSTRAINT `PK_SALES_ORDER_TAX` PRIMARY KEY (
	`tax_id`
);

ALTER TABLE `sales_order_aggregated_updated` ADD CONSTRAINT `PK_SALES_ORDER_AGGREGATED_UPDATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `salesrule_product_attribute` ADD CONSTRAINT `PK_SALESRULE_PRODUCT_ATTRIBUTE` PRIMARY KEY (
	`attribute_id`,
	`customer_group_id`,
	`rule_id`,
	`website_id`
);

ALTER TABLE `sales_payment_transaction` ADD CONSTRAINT `PK_SALES_PAYMENT_TRANSACTION` PRIMARY KEY (
	`transaction_id`,
	`order_id`,
	`payment_id`
);

ALTER TABLE `salesrule_coupon_aggregated_order` ADD CONSTRAINT `PK_SALESRULE_COUPON_AGGREGATED_ORDER` PRIMARY KEY (
	`id`
);

ALTER TABLE `salesrule_label` ADD CONSTRAINT `PK_SALESRULE_LABEL` PRIMARY KEY (
	`label_id`,
	`rule_id`,
	`store_id`
);

ALTER TABLE `sales_refunded_aggregated` ADD CONSTRAINT `PK_SALES_REFUNDED_AGGREGATED` PRIMARY KEY (
	`id`
);

ALTER TABLE `salesrule_coupon_usage` ADD CONSTRAINT `FK_salesrule_coupon_TO_salesrule_coupon_usage_1` FOREIGN KEY (
	`coupon_id`
)
REFERENCES `salesrule_coupon` (
	`coupon_id`
);

ALTER TABLE `salesrule_coupon_usage` ADD CONSTRAINT `FK_customer_entity_TO_salesrule_coupon_usage_1` FOREIGN KEY (
	`customer_id`
)
REFERENCES `customer_entity` (
	`entity_id`
);

ALTER TABLE `salesrule_coupon_aggregated` ADD CONSTRAINT `FK_store_TO_salesrule_coupon_aggregated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_shipment_item` ADD CONSTRAINT `FK_sales_shipment_TO_sales_shipment_item_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_shipment` (
	`entity_id`
);

ALTER TABLE `sales_order_status_state` ADD CONSTRAINT `FK_sales_order_status_TO_sales_order_status_state_1` FOREIGN KEY (
	`status`
)
REFERENCES `sales_order_status` (
	`status`
);

ALTER TABLE `sales_invoiced_aggregated_order` ADD CONSTRAINT `FK_store_TO_sales_invoiced_aggregated_order_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_bestsellers_aggregated_monthly` ADD CONSTRAINT `FK_store_TO_sales_bestsellers_aggregated_monthly_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_order_status_label` ADD CONSTRAINT `FK_sales_order_status_TO_sales_order_status_label_1` FOREIGN KEY (
	`status`
)
REFERENCES `sales_order_status` (
	`status`
);

ALTER TABLE `sales_order_status_label` ADD CONSTRAINT `FK_store_TO_sales_order_status_label_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_sequence_profile` ADD CONSTRAINT `FK_sales_sequence_meta_TO_sales_sequence_profile_1` FOREIGN KEY (
	`meta_id`
)
REFERENCES `sales_sequence_meta` (
	`meta_id`
);

ALTER TABLE `salesrule_coupon_aggregated_updated` ADD CONSTRAINT `FK_store_TO_salesrule_coupon_aggregated_updated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_bestsellers_aggregated_daily` ADD CONSTRAINT `FK_store_TO_sales_bestsellers_aggregated_daily_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_order_item` ADD CONSTRAINT `FK_sales_order_TO_sales_order_item_1` FOREIGN KEY (
	`order_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_order_item` ADD CONSTRAINT `FK_store_TO_sales_order_item_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_invoice` ADD CONSTRAINT `FK_sales_order_TO_sales_invoice_1` FOREIGN KEY (
	`order_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_invoice` ADD CONSTRAINT `FK_store_TO_sales_invoice_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_order_payment` ADD CONSTRAINT `FK_sales_order_TO_sales_order_payment_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_shipment_track` ADD CONSTRAINT `FK_sales_shipment_TO_sales_shipment_track_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_shipment` (
	`entity_id`
);

ALTER TABLE `sales_order_tax_item` ADD CONSTRAINT `FK_sales_order_tax_TO_sales_order_tax_item_1` FOREIGN KEY (
	`tax_id`
)
REFERENCES `sales_order_tax` (
	`tax_id`
);

ALTER TABLE `sales_order_tax_item` ADD CONSTRAINT `FK_sales_order_item_TO_sales_order_tax_item_1` FOREIGN KEY (
	`item_id`
)
REFERENCES `sales_order_item` (
	`item_id`
);

ALTER TABLE `sales_order_tax_item` ADD CONSTRAINT `FK_sales_order_item_TO_sales_order_tax_item_2` FOREIGN KEY (
	`associated_item_id`
)
REFERENCES `sales_order_item` (
	`item_id`
);

ALTER TABLE `sales_shipping_aggregated_order` ADD CONSTRAINT `FK_store_TO_sales_shipping_aggregated_order_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `salesrule_coupon` ADD CONSTRAINT `FK_salesrule_TO_salesrule_coupon_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `salesrule_customer` ADD CONSTRAINT `FK_customer_entity_TO_salesrule_customer_1` FOREIGN KEY (
	`customer_id`
)
REFERENCES `customer_entity` (
	`entity_id`
);

ALTER TABLE `salesrule_customer` ADD CONSTRAINT `FK_salesrule_TO_salesrule_customer_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `sales_bestsellers_aggregated_yearly` ADD CONSTRAINT `FK_store_TO_sales_bestsellers_aggregated_yearly_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_creditmemo_comment` ADD CONSTRAINT `FK_sales_creditmemo_TO_sales_creditmemo_comment_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_creditmemo` (
	`entity_id`
);

ALTER TABLE `sales_invoiced_aggregated` ADD CONSTRAINT `FK_store_TO_sales_invoiced_aggregated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `salesrule_customer_group` ADD CONSTRAINT `FK_customer_group_TO_salesrule_customer_group_1` FOREIGN KEY (
	`customer_group_id`
)
REFERENCES `customer_group` (
	`customer_group_id`
);

ALTER TABLE `salesrule_customer_group` ADD CONSTRAINT `FK_salesrule_TO_salesrule_customer_group_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `sales_shipment_comment` ADD CONSTRAINT `FK_sales_shipment_TO_sales_shipment_comment_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_shipment` (
	`entity_id`
);

ALTER TABLE `sales_order` ADD CONSTRAINT `FK_store_TO_sales_order_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_order` ADD CONSTRAINT `FK_customer_entity_TO_sales_order_1` FOREIGN KEY (
	`customer_id`
)
REFERENCES `customer_entity` (
	`entity_id`
);

ALTER TABLE `sales_invoice_item` ADD CONSTRAINT `FK_sales_invoice_TO_sales_invoice_item_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_invoice` (
	`entity_id`
);

ALTER TABLE `sales_order_address` ADD CONSTRAINT `FK_sales_order_TO_sales_order_address_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `salesrule_website` ADD CONSTRAINT `FK_salesrule_TO_salesrule_website_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `salesrule_website` ADD CONSTRAINT `FK_store_website_TO_salesrule_website_1` FOREIGN KEY (
	`website_id`
)
REFERENCES `store_website` (
	`website_id`
);

ALTER TABLE `sales_order_status_history` ADD CONSTRAINT `FK_sales_order_TO_sales_order_status_history_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_invoice_comment` ADD CONSTRAINT `FK_sales_invoice_TO_sales_invoice_comment_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_invoice` (
	`entity_id`
);

ALTER TABLE `sales_order_aggregated_created` ADD CONSTRAINT `FK_store_TO_sales_order_aggregated_created_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_shipment` ADD CONSTRAINT `FK_sales_order_TO_sales_shipment_1` FOREIGN KEY (
	`order_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_shipment` ADD CONSTRAINT `FK_store_TO_sales_shipment_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_creditmemo_item` ADD CONSTRAINT `FK_sales_creditmemo_TO_sales_creditmemo_item_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_creditmemo` (
	`entity_id`
);

ALTER TABLE `sales_shipping_aggregated` ADD CONSTRAINT `FK_store_TO_sales_shipping_aggregated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_creditmemo` ADD CONSTRAINT `FK_sales_order_TO_sales_creditmemo_1` FOREIGN KEY (
	`order_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_creditmemo` ADD CONSTRAINT `FK_store_TO_sales_creditmemo_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_refunded_aggregated_order` ADD CONSTRAINT `FK_store_TO_sales_refunded_aggregated_order_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_order_aggregated_updated` ADD CONSTRAINT `FK_store_TO_sales_order_aggregated_updated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `salesrule_product_attribute` ADD CONSTRAINT `FK_eav_attribute_TO_salesrule_product_attribute_1` FOREIGN KEY (
	`attribute_id`
)
REFERENCES `eav_attribute` (
	`attribute_id`
);

ALTER TABLE `salesrule_product_attribute` ADD CONSTRAINT `FK_customer_group_TO_salesrule_product_attribute_1` FOREIGN KEY (
	`customer_group_id`
)
REFERENCES `customer_group` (
	`customer_group_id`
);

ALTER TABLE `salesrule_product_attribute` ADD CONSTRAINT `FK_salesrule_TO_salesrule_product_attribute_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `salesrule_product_attribute` ADD CONSTRAINT `FK_store_website_TO_salesrule_product_attribute_1` FOREIGN KEY (
	`website_id`
)
REFERENCES `store_website` (
	`website_id`
);

ALTER TABLE `sales_payment_transaction` ADD CONSTRAINT `FK_sales_order_TO_sales_payment_transaction_1` FOREIGN KEY (
	`order_id`
)
REFERENCES `sales_order` (
	`entity_id`
);

ALTER TABLE `sales_payment_transaction` ADD CONSTRAINT `FK_sales_order_payment_TO_sales_payment_transaction_1` FOREIGN KEY (
	`payment_id`
)
REFERENCES `sales_order_payment` (
	`entity_id`
);

ALTER TABLE `sales_payment_transaction` ADD CONSTRAINT `FK_sales_payment_transaction_TO_sales_payment_transaction_1` FOREIGN KEY (
	`parent_id`
)
REFERENCES `sales_payment_transaction` (
	`transaction_id`
);

ALTER TABLE `salesrule_coupon_aggregated_order` ADD CONSTRAINT `FK_store_TO_salesrule_coupon_aggregated_order_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `salesrule_label` ADD CONSTRAINT `FK_salesrule_TO_salesrule_label_1` FOREIGN KEY (
	`rule_id`
)
REFERENCES `salesrule` (
	`rule_id`
);

ALTER TABLE `salesrule_label` ADD CONSTRAINT `FK_store_TO_salesrule_label_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

ALTER TABLE `sales_refunded_aggregated` ADD CONSTRAINT `FK_store_TO_sales_refunded_aggregated_1` FOREIGN KEY (
	`store_id`
)
REFERENCES `store` (
	`store_id`
);

