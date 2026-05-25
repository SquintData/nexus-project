-- Revoke RPC exec on legacy rls_auto_enable (not used by Nexus)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
