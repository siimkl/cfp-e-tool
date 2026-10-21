begin;
-- Reject credentials in the authority, not valid @ characters in a Teams event path.
alter table public.items drop constraint items_homepage_url_check;
alter table public.items add constraint items_homepage_url_check check (
 homepage_url is null or homepage_url ~* '^https?://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$'
);
commit;
