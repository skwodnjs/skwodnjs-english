-- Emergency password reset for skwodnjs-english.
-- After this script runs, the next API request recreates the default
-- authentication setting and the admin password becomes 1234 again.

DELETE FROM app_settings WHERE key = 'auth.password';
DELETE FROM auth_sessions;
