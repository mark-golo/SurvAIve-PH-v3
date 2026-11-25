<?php
// PhilSMS gateway configuration.
// IMPORTANT: replace placeholder values with real credentials from the PhilSMS dashboard
// before going live. Never commit real tokens to version control.

define('PHILSMS_API_TOKEN',       'replace_with_philsms_api_token');
define('PHILSMS_SENDER_ID',       'SurvAIvePH');
define('PHILSMS_API_BASE_URL',    'https://app.philsms.com/api/v3');
// Secret used to verify that inbound webhook POSTs genuinely come from PhilSMS.
// Generate a strong random string; configure the identical value in the PhilSMS
// webhook settings panel.
define('PHILSMS_WEBHOOK_SECRET',  'replace_with_webhook_secret');
// The PhilSMS-provisioned number that victim devices send their emergency SMS to.
// This is not a secret — it is the number printed on public materials.
define('PHILSMS_RECEIVING_NUMBER', '09XXXXXXXXX');
