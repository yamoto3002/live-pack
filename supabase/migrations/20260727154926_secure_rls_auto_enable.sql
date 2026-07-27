-- Keep the platform event trigger working while preventing browser-facing
-- roles from invoking this SECURITY DEFINER function through the Data API.
revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

-- Preserve explicit access for the function owner and Supabase administration.
grant execute on function public.rls_auto_enable()
to postgres, supabase_admin;
